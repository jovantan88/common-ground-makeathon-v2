"use client";

import {
  ArrowRightIcon,
  CopyIcon,
  GitForkIcon,
  GlobeIcon,
  LockIcon,
  MapIcon,
  PaletteIcon,
  PencilIcon,
  RotateCcwIcon,
  SearchIcon,
  StarIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { ComicPage } from "@/components/comic/comic-page";
import type { SheetStatus } from "@/components/comic/comic-sheet";
import { LoadingComic, TipsDeck } from "@/components/comic/loading-comic";
import { OriginFile } from "@/components/comic/origin-file";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  allSheets,
  directSheet,
  drawSheet,
  draftChapter,
  finalizeChapter,
  getOwnerToken,
  newOwnerToken,
  newSheet,
  newStoryId,
  requestCastSheet,
  requestCover,
  saveStory,
  setOwnerToken,
  streamChapter,
} from "@/lib/client/api";
import { heroDisplayName, type Page, type Sheet, type Story } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};
/** The art director can plan this many pages ahead while the illustrator paints one at a time. */
const MAX_DIRECTING = 2;

export function StoryReader({ initial }: { initial: Story }) {
  const router = useRouter();
  const [story, setStory] = useState(initial);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  /** What the artist team is doing: the art director plans pages, then the illustrator paints them one by one. */
  const [phases, setPhases] = useState<ReadonlyMap<string, "directing" | "drawing">>(new Map());
  const [turning, setTurning] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [score, setScore] = useState({ right: 0, answered: 0 });
  const inflight = useRef(new Set<string>());
  const dirty = useRef(false);
  const saver = useRef<{ busy: boolean; next: Story | null }>({ busy: false, next: null });
  const autoStarted = useRef(false);

  // Only the browser that created a saga holds its owner token.
  const token = useSyncExternalStore(
    noopSubscribe,
    () => getOwnerToken(story.id),
    () => null
  );
  const isOwner = !!token;

  /* ---------------- persistence (coalesced, in order) ---------------- */

  const persist = useCallback(
    async (s: Story) => {
      if (!token) return;
      const q = saver.current;
      q.next = s;
      if (q.busy) return;
      q.busy = true;
      try {
        while (q.next) {
          const current = q.next;
          q.next = null;
          await saveStory(current, token);
        }
      } catch (e) {
        toast.error(`Couldn't save your saga: ${(e as Error).message}`);
      } finally {
        q.busy = false;
      }
    },
    [token]
  );

  useEffect(() => {
    if (dirty.current) {
      dirty.current = false;
      persist(story);
    }
  }, [story, persist]);

  const update = useCallback((fn: (s: Story) => Story) => {
    dirty.current = true;
    setStory(fn);
  }, []);

  const updatePage = useCallback(
    (pageId: string, fn: (p: Page) => Page) =>
      update((s) => ({ ...s, pages: s.pages.map((p) => (p.id === pageId ? fn(p) : p)) })),
    [update]
  );

  /* ---------------- artwork orchestration (owner only) ---------------- */

  useEffect(() => {
    if (!isOwner) return;
    const setPhase = (id: string, phase: "directing" | "drawing" | null) =>
      setPhases((m) => {
        const next = new Map(m);
        if (phase) next.set(id, phase);
        else next.delete(id);
        return next;
      });
    const running = (prefix: string) => [...inflight.current].filter((k) => k.startsWith(prefix)).length;
    const start = (kind: string, id: string, phase: "directing" | "drawing", job: () => Promise<void>) => {
      const key = `${kind}:${id}`;
      if (inflight.current.has(key) || failed.has(id)) return false;
      inflight.current.add(key);
      setPhase(id, phase);
      job()
        .catch((e) => {
          setFailed((f) => new Set(f).add(id));
          toast.error((e as Error).message);
        })
        .finally(() => {
          inflight.current.delete(key);
          setPhase(id, null);
        });
      return true;
    };
    const patchSheet = (pageId: string, sheetId: string, patch: Partial<Sheet>) =>
      updatePage(pageId, (p) => ({ ...p, sheets: p.sheets.map((sh) => (sh.id === sheetId ? { ...sh, ...patch } : sh)) }));

    // Art references: the cover (the hero's face) and the cast model sheet (everyone else).
    if (!story.coverUrl) {
      start("cover", "cover", "drawing", async () => {
        const { url } = await requestCover(story.id, story.hero, story.heritage, story.research);
        update((s) => ({ ...s, coverUrl: url }));
      });
    }
    const outline = story.outline;
    const hasCast = !!outline && outline.cast.length > 0;
    if (outline && hasCast && !story.castUrl) {
      start("cast", "cast", "drawing", async () => {
        const { url } = await requestCastSheet(story.id, outline, story.heritage);
        update((s) => ({ ...s, castUrl: url }));
      });
    }
    const refsReady =
      (!!story.coverUrl || failed.has("cover")) && (!hasCast || !!story.castUrl || failed.has("cast"));

    const sheets = allSheets(story);

    // The art director plans pages ahead of time (planning needs only the script).
    for (const { page, sheet } of sheets) {
      if (running("direct:") >= MAX_DIRECTING) break;
      if (sheet.imageUrl || sheet.art) continue;
      start("direct", sheet.id, "directing", async () => {
        const art = await directSheet(story, page, sheet);
        patchSheet(page.id, sheet.id, { art });
      });
    }

    // The illustrator paints one page at a time, in order, so each page can look at the one before it.
    const next = sheets.find((x) => !x.sheet.imageUrl && !failed.has(x.sheet.id));
    if (refsReady && next?.sheet.art && running("draw:") === 0) {
      start("draw", next.sheet.id, "drawing", async () => {
        const { url } = await drawSheet(story, next.page, next.sheet);
        patchSheet(next.page.id, next.sheet.id, { imageUrl: url });
      });
    }
  }, [story, isOwner, failed, phases, update, updatePage]);

  const coverStatus = (): SheetStatus =>
    story.coverUrl ? "ready" : failed.has("cover") ? "failed" : !isOwner ? "idle" : phases.has("cover") ? "drawing" : "queued";

  const sheetStatus = (sheet: Sheet): SheetStatus =>
    sheet.imageUrl
      ? "ready"
      : failed.has(sheet.id)
        ? "failed"
        : !isOwner
          ? "idle"
          : (phases.get(sheet.id) ?? "queued");

  const retry = (key: string) =>
    setFailed((f) => {
      const n = new Set(f);
      n.delete(key);
      return n;
    });

  // Clearing the image makes the painter pick this page up again (its art plan is kept).
  const redraw = (pageId: string, sheetId: string) =>
    updatePage(pageId, (p) => ({
      ...p,
      sheets: p.sheets.map((sh) => (sh.id === sheetId ? { ...sh, imageUrl: null } : sh)),
    }));

  /* ---------------- writing chapters (streamed) ---------------- */

  const turnPage = useCallback(
    async (text: string | null) => {
      const choice = text?.trim() || null;
      if (turning || (story.pages.length > 0 && !choice)) return;
      setTurning(true);
      const draft = draftChapter(choice);
      const n = story.pages.filter((p) => !p.streaming).length + 1;
      setStory((s) => ({ ...s, pages: [...s.pages, draft] }));
      setTimeout(
        () => document.getElementById(`page-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
        120
      );

      try {
        const chapter = await streamChapter(story, choice, {
          meta: (m) => setStory((s) => withPage(s, draft.id, (p) => ({ ...p, ...m }))),
          sheet: (sheet, index) =>
            setStory((s) =>
              withPage(s, draft.id, (p) =>
                p.sheets.length === index ? { ...p, sheets: [...p.sheets, newSheet(sheet)] } : p
              )
            ),
        });
        update((s) => withPage(s, draft.id, (p) => finalizeChapter(p, chapter)));
        setPrompt("");
      } catch (e) {
        setStory((s) => ({ ...s, pages: s.pages.filter((p) => p.id !== draft.id) }));
        toast.error((e as Error).message);
        if (choice) setPrompt(choice);
      } finally {
        setTurning(false);
      }
    },
    [story, turning, update]
  );

  // A brand-new saga starts writing chapter 1 as soon as its creator opens it.
  useEffect(() => {
    if (!isOwner || autoStarted.current || story.pages.length > 0) return;
    autoStarted.current = true;
    turnPage(null);
  }, [isOwner, story.pages.length, turnPage]);

  /* ---------------- actions ---------------- */

  function toggleShare() {
    const next = !story.isPublic;
    update((s) => ({ ...s, isPublic: next }));
    toast.success(next ? "Shared to the community gallery!" : "Removed from the gallery.");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied — send it to your family!");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  async function remix() {
    const id = newStoryId();
    const t = newOwnerToken();
    const now = new Date().toISOString();
    const pages = story.pages.filter((p) => !p.streaming);
    try {
      await saveStory({ ...story, id, pages, isPublic: false, isFeatured: false, createdAt: now, updatedAt: now }, t);
      setOwnerToken(id, t);
      toast.success("Remixed! This copy is yours to continue.");
      router.push(`/story/${id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const finished = story.pages.filter((p) => !p.streaming);
  const writing = story.pages.find((p) => p.streaming);
  const pendingSheets = allSheets(story).filter((x) => !x.sheet.imageUrl && !failed.has(x.sheet.id));
  const sheetIds = new Set(pendingSheets.map((x) => x.sheet.id));
  const directing = [...phases].filter(([id, ph]) => ph === "directing" && sheetIds.has(id)).length;
  const painting = [...phases].filter(([id, ph]) => ph === "drawing" && sheetIds.has(id)).length;
  const prepping = phases.has("cover") ? "Painting the cover" : phases.has("cast") ? "Sketching the cast" : "";
  const last = finished[finished.length - 1];
  const heroName = heroDisplayName(story.hero);
  const actReached = Math.max(0, ...finished.map((p) => p.act ?? 0));

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:py-12">
      {/* ------------------------------ Cover ------------------------------ */}
      <section className="grid items-start gap-8 md:grid-cols-[minmax(0,360px)_1fr]">
        <Cover story={story} status={coverStatus()} onRetry={() => retry("cover")} />

        <div className="space-y-5">
          <div className="space-y-2">
            <span className="caption-box inline-block px-2 py-0.5 text-sm">
              A {story.heritage.name} saga · {finished.length} {finished.length === 1 ? "chapter" : "chapters"}
            </span>
            <h1 className="comic-title text-5xl sm:text-7xl">{story.title}</h1>
            <p className="text-xl font-bold">{story.tagline}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="border-[3px] border-ink bg-white px-3 py-1 font-bold shadow-comic-sm">
              Starring <span className="text-zap">{heroName}</span>
            </span>
            {score.answered > 0 && (
              <span className="inline-flex animate-pop-in items-center gap-1 border-[3px] border-ink bg-pow px-3 py-1 font-bold shadow-comic-sm">
                <StarIcon className="size-4 fill-current" /> History XP {score.right}/{score.answered}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {isOwner ? (
              <Button variant={story.isPublic ? "jade" : "secondary"} onClick={toggleShare}>
                {story.isPublic ? <GlobeIcon /> : <LockIcon />}
                {story.isPublic ? "In the gallery" : "Share to gallery"}
              </Button>
            ) : (
              <Button variant="blue" onClick={remix}>
                <GitForkIcon /> Remix & continue
              </Button>
            )}
            <Button variant="outline" onClick={copyLink}>
              <CopyIcon /> Copy link
            </Button>
          </div>

          {story.outline && (
            <div className="comic-box space-y-4 bg-white p-4">
              <div>
                <p className="comic-title flex items-center gap-2 text-xl text-zap">
                  <SearchIcon className="size-5" /> The mystery
                </p>
                <p className="font-bold">{story.outline.mystery}</p>
              </div>
              <div>
                <p className="comic-title flex items-center gap-2 text-xl">
                  <UsersIcon className="size-5" /> Cast
                </p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  <li className="border-2 border-ink bg-pow px-2 py-0.5 text-sm font-bold">
                    {heroName} <span className="font-normal">· you!</span>
                  </li>
                  {story.outline.cast.map((c) => (
                    <li key={c.name} className="border-2 border-ink bg-paper px-2 py-0.5 text-sm font-bold">
                      {c.name} <span className="font-normal text-muted-foreground">· {c.role}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>

      {story.outline && <JourneyMap acts={story.outline.acts} reached={actReached} pages={finished} />}

      <details className="group">
        <summary className="comic-title inline-flex cursor-pointer list-none items-center gap-2 border-[3px] border-ink bg-ink px-4 py-2 text-2xl text-pow shadow-comic-sm select-none">
          <span className="transition-transform group-open:rotate-90">▶</span> Open the {story.hero.surname} origin file
        </summary>
        <div className="mt-4">
          <OriginFile research={story.research} />
        </div>
      </details>

      {/* ------------------------------ Chapters ------------------------------ */}
      {story.pages.map((page, i) => (
        <div key={page.id} className="space-y-6">
          {page.prompt && <ReaderChoice who={story.hero.name || "You"} text={page.prompt} />}
          {page.streaming && page.sheets.length === 0 ? (
            <div id={`page-${i + 1}`} className="scroll-mt-24">
              <LoadingComic title={i === 0 ? "Your saga begins…" : `Writing chapter ${i + 1}…`}>
                <TipsDeck
                  surname={story.hero.surname}
                  heritage={story.heritage}
                  avoid={story.research.funFacts}
                />
              </LoadingComic>
            </div>
          ) : (
            <ComicPage
              page={page}
              index={i}
              heritage={story.heritage}
              sheetStatus={sheetStatus}
              onRetrySheet={isOwner ? (sheet) => retry(sheet.id) : undefined}
              onRedrawSheet={isOwner ? (sheet) => redraw(page.id, sheet.id) : undefined}
              onQuizAnswer={(ok) => setScore((s) => ({ right: s.right + (ok ? 1 : 0), answered: s.answered + 1 }))}
            />
          )}
        </div>
      ))}

      {isOwner && (writing || pendingSheets.length > 0 || prepping) && (
        <StudioBar
          writer={
            writing
              ? writing.sheets.length
                ? `Scripting page ${writing.sheets.length + 1} of chapter ${story.pages.indexOf(writing) + 1}…`
                : `Planning chapter ${story.pages.indexOf(writing) + 1}…`
              : "Script done — waiting for your choice"
          }
          writerBusy={!!writing}
          artist={
            pendingSheets.length || prepping
              ? [
                  prepping,
                  directing ? `Planning ${directing} page${directing > 1 ? "s" : ""}` : "",
                  painting ? "Painting a page" : "",
                  pendingSheets.length ? `${pendingSheets.length} to go` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "All pages drawn"
          }
          artistBusy={pendingSheets.length > 0 || !!prepping}
        />
      )}

      {/* ------------------------------ What next ------------------------------ */}
      {isOwner
        ? last &&
          !turning && <NextPrompt page={last} prompt={prompt} setPrompt={setPrompt} onChoose={turnPage} />
        : finished.length > 0 && (
            <section className="comic-box space-y-4 bg-white p-6 text-center sm:p-10">
              <h2 className="comic-title text-4xl sm:text-5xl">Want to know what happens next?</h2>
              <p className="mx-auto max-w-xl text-lg">
                This saga belongs to {heroName}. Remix it to keep the story going yourself — or discover the history
                behind your own surname.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button size="lg" variant="blue" onClick={remix}>
                  <GitForkIcon /> Remix & continue
                </Button>
                <Button size="lg" asChild>
                  <Link href="/create">Start my own saga</Link>
                </Button>
              </div>
            </section>
          )}
    </div>
  );
}

/** The two AIs at work: the writer scripts, the artist team (art director + illustrator) draws. */
function StudioBar({
  writer,
  writerBusy,
  artist,
  artistBusy,
}: {
  writer: string;
  writerBusy: boolean;
  artist: string;
  artistBusy: boolean;
}) {
  return (
    <div className="sticky bottom-3 z-30 mx-auto grid max-w-3xl gap-2 sm:grid-cols-2">
      {[
        { who: "Writer AI", icon: PencilIcon, text: writer, busy: writerBusy, color: "bg-white" },
        { who: "Artist AI", icon: PaletteIcon, text: artist, busy: artistBusy, color: "bg-pow" },
      ].map(({ who, icon: Icon, text, busy, color }) => (
        <div
          key={who}
          className={cn("flex items-center gap-3 border-[3px] border-ink px-3 py-2 shadow-comic-sm", color)}
        >
          <span className="grid size-9 shrink-0 place-items-center border-2 border-ink bg-ink text-pow">
            <Icon className={cn("size-5", busy && "animate-wiggle")} />
          </span>
          <span className="min-w-0">
            <span className="comic-title block text-lg leading-none">{who}</span>
            <span className="block truncate text-sm font-bold">{text}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function withPage(s: Story, pageId: string, fn: (p: Page) => Page): Story {
  return { ...s, pages: s.pages.map((p) => (p.id === pageId ? fn(p) : p)) };
}

function JourneyMap({
  acts,
  reached,
  pages,
}: {
  acts: NonNullable<Story["outline"]>["acts"];
  reached: number;
  pages: Page[];
}) {
  return (
    <nav className="comic-box bg-white p-4 sm:p-5" aria-label="Journey map">
      <p className="comic-title flex items-center gap-2 text-2xl">
        <MapIcon className="size-5" /> Journey map
      </p>
      <ol className="mt-3 flex gap-2 overflow-x-auto pb-2">
        {acts.map((act, i) => {
          const n = i + 1;
          const unlocked = n <= Math.max(reached, 1);
          const firstPage = pages.findIndex((p) => p.act === n);
          const inner = (
            <>
              <span className={cn("comic-title text-lg leading-none", unlocked ? "text-zap" : "text-muted-foreground")}>
                Act {n}
              </span>
              <span className="block text-sm font-bold leading-tight">{unlocked ? act.place : "???"}</span>
              <span className="block text-xs text-muted-foreground">{unlocked ? act.era : "Locked"}</span>
            </>
          );
          return (
            <li key={i} className="flex shrink-0 items-center gap-2">
              {firstPage >= 0 ? (
                <a
                  href={`#page-${firstPage + 1}`}
                  className={cn(
                    "block w-36 border-[2.5px] border-ink p-2 transition-transform hover:-translate-y-0.5",
                    n === reached ? "bg-pow shadow-comic-sm" : "bg-paper"
                  )}
                >
                  {inner}
                </a>
              ) : (
                <div
                  className={cn(
                    "w-36 border-[2.5px] p-2",
                    unlocked ? "border-ink bg-paper" : "border-dashed border-ink/40 bg-muted/50"
                  )}
                >
                  {inner}
                </div>
              )}
              {i < acts.length - 1 && <ArrowRightIcon className="size-4 shrink-0 text-ink/50" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Cover({ story, status, onRetry }: { story: Story; status: SheetStatus; onRetry: () => void }) {
  const hanzi = story.research.nativeScript.split(/[\s(（]/)[0];
  const issue = story.pages.filter((p) => !p.streaming).length || 1;
  return (
    <div className="comic-box relative aspect-[2/3] overflow-hidden bg-paper md:rotate-[-1.5deg]">
      {story.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={story.coverUrl} alt={`Cover of ${story.title}`} className="absolute inset-0 size-full animate-pop-in object-cover" />
      ) : (
        <div className="pencil-sketch animate-ink absolute inset-0 grid place-items-center p-6 text-center">
          {status === "failed" ? (
            <div className="space-y-2">
              <p className="comic-title text-3xl text-zap">The cover smudged!</p>
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RotateCcwIcon /> Repaint
              </Button>
            </div>
          ) : (
            <p className="comic-title flex items-center gap-2 text-3xl">
              {status !== "idle" && <PencilIcon className="size-7 animate-wiggle" />}
              {status !== "idle" ? "Painting cover…" : "No cover yet"}
            </p>
          )}
        </div>
      )}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-ink/85 via-ink/40 to-transparent p-4 pb-16">
        <div className="flex items-start justify-between">
          <span className="border-2 border-ink bg-zap px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-white uppercase">
            Surname Saga
          </span>
          <span className="border-2 border-ink bg-white px-1.5 text-center text-[10px] leading-tight font-bold">
            No.
            <br />
            <span className="comic-title text-lg">{issue}</span>
          </span>
        </div>
        <p className="comic-title mt-2 text-4xl text-pow text-outline sm:text-5xl">{story.title}</p>
      </div>
      <span className="burst absolute right-3 bottom-3 grid size-20 place-items-center bg-zap text-white">
        <span className={cn(hanzi ? "font-brush text-4xl" : "comic-title text-xl")}>{hanzi || story.hero.surname}</span>
      </span>
    </div>
  );
}

function ReaderChoice({ who, text }: { who: string; text: string }) {
  return (
    <div className="flex justify-end pt-4">
      <div className="speech max-w-md -rotate-1 px-4 py-2" data-tail="right">
        <span className="block text-xs font-bold tracking-wider text-zap uppercase">{who} chose…</span>
        <p className="font-bold">{text}</p>
      </div>
    </div>
  );
}

function NextPrompt({
  page,
  prompt,
  setPrompt,
  onChoose,
}: {
  page: Page;
  prompt: string;
  setPrompt: (s: string) => void;
  onChoose: (s: string) => void;
}) {
  return (
    <section className="comic-box sunburst relative overflow-hidden p-5 sm:p-8">
      <h2 className="comic-title text-center text-5xl text-white text-outline sm:text-6xl">
        {page.isFinale ? "The end… or is it?" : "What happens next?"}
      </h2>
      <p className="mt-2 text-center font-bold">You&apos;re the hero. Pick a path or write your own twist.</p>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {page.choices.map((c, i) => (
          <button
            key={c}
            type="button"
            onClick={() => onChoose(c)}
            className="comic-box flex gap-3 bg-white p-4 text-left font-bold transition-all hover:-translate-y-1 hover:-rotate-1 hover:bg-paper hover:shadow-comic-lg"
          >
            <span className="comic-title text-4xl leading-none text-zap">{i + 1}</span>
            <span className="flex-1">{c}</span>
          </button>
        ))}
      </div>
      <form
        className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch"
        onSubmit={(e) => {
          e.preventDefault();
          onChoose(prompt);
        }}
      >
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onChoose(prompt);
            }
          }}
          maxLength={500}
          rows={1}
          placeholder="…or write your own! e.g. “Sneak aboard the ship before it sails”"
          className="min-h-12 flex-1 text-base"
        />
        <Button type="submit" size="lg" disabled={!prompt.trim()} className="h-auto min-h-12">
          Turn the page! <ArrowRightIcon />
        </Button>
      </form>
    </section>
  );
}
