"use client";

import { CheckIcon, HomeIcon, MapPinIcon, RotateCcwIcon, SearchIcon, ZapIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Burst } from "@/components/comic/burst";
import { LoadingComic, TipsDeck } from "@/components/comic/loading-comic";
import { OriginFile } from "@/components/comic/origin-file";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newOwnerToken, newStoryId, postJSON, requestCover, saveStory, setOwnerToken } from "@/lib/client/api";
import { PRONOUNS, type HeritageOption, type Hero, type Outline, type Research, type Story } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Phase = "setup" | "research" | "choose" | "writing" | "error";

export function SagaCreator({ initialSurname, initialName }: { initialSurname: string; initialName: string }) {
  const router = useRouter();
  const [hero, setHero] = useState<Hero>({
    name: initialName,
    surname: initialSurname,
    pronouns: "they",
    look: "",
    home: "",
  });
  const [phase, setPhase] = useState<Phase>(initialSurname ? "research" : "setup");
  const [research, setResearch] = useState<Research | null>(null);
  const [heritageId, setHeritageId] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; retry: () => void } | null>(null);
  const [steps, setSteps] = useState({ plot: false, cover: false });
  const [seenFacts, setSeenFacts] = useState<string[]>([]);
  const researchStarted = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== "research" || researchStarted.current === hero.surname) return;
    researchStarted.current = hero.surname;
    postJSON<{ research: Research }>("/api/research", { surname: hero.surname })
      .then(({ research }) => {
        setResearch(research);
        setHeritageId(research.heritageOptions[0]?.id ?? null);
        setPhase("choose");
      })
      .catch((e: Error) => {
        setError({
          message: e.message,
          retry: () => {
            researchStarted.current = null;
            setPhase("research");
          },
        });
        setPhase("error");
      });
  }, [phase, hero.surname]);

  const heritage = research?.heritageOptions.find((h) => h.id === heritageId) ?? null;

  async function begin() {
    if (!research || !heritage) return;
    setPhase("writing");
    setSteps({ plot: false, cover: false });
    window.scrollTo({ top: 0, behavior: "smooth" });

    const id = newStoryId();
    const token = newOwnerToken();
    // Paint the cover while the saga is being plotted; it's also the face reference for every panel.
    const cover = requestCover(id, hero, heritage, research)
      .then((r) => r.url)
      .catch(() => null)
      .finally(() => setSteps((s) => ({ ...s, cover: true })));

    try {
      const { outline } = await postJSON<{ outline: Outline }>("/api/story/outline", { hero, heritage, research });
      setSteps((s) => ({ ...s, plot: true }));
      const now = new Date().toISOString();
      const story: Story = {
        id,
        version: 1,
        hero,
        heritage,
        research,
        outline,
        title: outline.title,
        tagline: outline.tagline,
        coverUrl: await cover,
        castUrl: null, // painted by the story page while chapter 1 is being written
        pages: [], // chapter 1 streams in on the story page
        isPublic: false,
        createdAt: now,
        updatedAt: now,
      };
      await saveStory(story, token);
      setOwnerToken(id, token);
      router.push(`/story/${id}`);
    } catch (e) {
      setError({ message: (e as Error).message, retry: () => setPhase("choose") });
      setPhase("error");
    }
  }

  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-xl">
        <SetupForm
          hero={hero}
          onSubmit={(h) => {
            setHero(h);
            setPhase("research");
          }}
        />
      </div>
    );
  }

  if (phase === "error" && error) {
    return (
      <div className="comic-box mx-auto max-w-xl space-y-4 bg-white p-8 text-center">
        <Burst className="size-32" color="bg-zap" textClassName="text-3xl text-white">
          Oops!
        </Burst>
        <p className="font-bold">{error.message}</p>
        <Button onClick={error.retry}>
          <RotateCcwIcon /> Try again
        </Button>
      </div>
    );
  }

  if (phase === "research") {
    return (
      <div className="grid items-start gap-8 lg:grid-cols-[1.4fr_1fr]">
        <LoadingComic title={`Digging up the ${hero.surname} files…`}>
          <TipsDeck surname={hero.surname} onFacts={setSeenFacts} />
        </LoadingComic>
        <div className="space-y-3">
          <p className="comic-title text-3xl">While we search the archives…</p>
          <HeroCustomizer hero={hero} onChange={setHero} />
        </div>
      </div>
    );
  }

  if (phase === "writing" && research && heritage) {
    return (
      <LoadingComic
        title="Plotting your saga…"
        steps={[
          { label: "Plotting the journey", done: steps.plot },
          { label: "Painting your cover", done: steps.cover },
        ]}
      >
        <TipsDeck
          surname={hero.surname}
          heritage={heritage}
          avoid={seenFacts.length ? seenFacts : research.funFacts}
        />
      </LoadingComic>
    );
  }

  if (!research) return null;

  return (
    <div className="space-y-10">
      <div className="text-center">
        <p className="comic-title text-2xl text-zap">Case file unlocked!</p>
        <h1 className="comic-title text-5xl sm:text-7xl">
          Meet your roots{hero.name ? `, ${hero.name}` : ""}!
        </h1>
      </div>

      <OriginFile research={research} />

      <section className="space-y-4">
        <div>
          <h2 className="comic-title text-4xl sm:text-5xl">Choose your heritage path</h2>
          <p className="max-w-2xl text-lg">
            Which branch of the {research.surname} family tree is yours? Ask your parents or grandparents which
            dialect or language the family spoke — or follow your gut. Your saga starts in that homeland and follows
            its people wherever history took them.
          </p>
        </div>
        <div role="radiogroup" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {research.heritageOptions.map((h) => (
            <HeritageCard key={h.id} option={h} selected={h.id === heritageId} onSelect={() => setHeritageId(h.id)} />
          ))}
        </div>
      </section>

      <section className="grid items-end gap-6 md:grid-cols-[1fr_auto]">
        <HeroCustomizer hero={hero} onChange={setHero} />
        <Button size="xl" onClick={begin} disabled={!heritage} className="w-full md:w-auto">
          <ZapIcon className="fill-current" /> Start the comic!
        </Button>
      </section>
    </div>
  );
}

const LIKELIHOOD = {
  high: { label: "Most likely", className: "bg-jade text-white" },
  medium: { label: "Possible", className: "bg-pow" },
  low: { label: "Less common", className: "bg-white" },
} as const;

function HeritageCard({
  option,
  selected,
  onSelect,
}: {
  option: HeritageOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const l = LIKELIHOOD[option.likelihood];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex flex-col gap-2 border-[3px] border-ink p-4 text-left transition-all",
        selected
          ? "-translate-x-1 -translate-y-1 bg-pow shadow-comic-lg"
          : "bg-white shadow-comic-sm hover:-translate-y-0.5 hover:shadow-comic"
      )}
    >
      {selected && (
        <span className="burst absolute -top-4 -right-4 grid size-12 place-items-center bg-zap text-white">
          <CheckIcon className="size-5" strokeWidth={3} />
        </span>
      )}
      <div className="flex items-baseline justify-between gap-2">
        <span className="comic-title text-3xl">{option.name}</span>
        {option.nativeName && (
          <span className={cn("font-brush shrink-0", option.nativeName.length > 3 ? "text-2xl" : "text-3xl")}>
            {option.nativeName}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className={cn("border-2 border-ink px-1.5 py-0.5 text-xs font-bold uppercase", l.className)}>{l.label}</span>
        <span className="border-2 border-ink bg-white px-1.5 py-0.5 text-xs font-bold">Spelled “{option.spelling}”</span>
      </div>
      <p className="flex gap-1 text-sm font-bold">
        <MapPinIcon className="mt-0.5 size-3.5 shrink-0" /> {option.homeland}
      </p>
      <p className="text-sm">{option.migrationStory}</p>
      <p className="mt-auto border-t-2 border-dashed border-ink/40 pt-2 text-xs italic">★ {option.funFact}</p>
    </button>
  );
}

function HeroCustomizer({ hero, onChange }: { hero: Hero; onChange: (h: Hero) => void }) {
  return (
    <div className="comic-box space-y-4 bg-white p-5">
      <p className="comic-title text-2xl">
        Your hero: <span className="text-zap">{hero.name ? `${hero.name} ${hero.surname}` : `Ah ${hero.surname}`}</span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="hero-name" className="font-bold">
            First name
          </Label>
          <Input
            id="hero-name"
            maxLength={40}
            value={hero.name}
            onChange={(e) => onChange({ ...hero, name: e.target.value })}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-bold">Pronouns</span>
          <div className="flex gap-2">
            {PRONOUNS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={hero.pronouns === p}
                onClick={() => onChange({ ...hero, pronouns: p })}
                className={cn(
                  "h-11 flex-1 border-[3px] border-ink font-bold transition-all",
                  hero.pronouns === p ? "bg-bam text-white shadow-comic-sm" : "bg-paper hover:bg-pow"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="hero-home" className="font-bold">
            <HomeIcon className="size-4" /> Where&apos;s home today?
          </Label>
          <Input
            id="hero-home"
            maxLength={80}
            value={hero.home}
            onChange={(e) => onChange({ ...hero, home: e.target.value })}
            placeholder="e.g. Singapore, Toronto, Sydney"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hero-look" className="font-bold">
            Your look <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="hero-look"
            maxLength={200}
            value={hero.look}
            onChange={(e) => onChange({ ...hero, look: e.target.value })}
            placeholder="e.g. 16, spiky hair, round glasses"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Your home shapes where the story begins and ends — leave it blank and history decides.
      </p>
    </div>
  );
}

function SetupForm({ hero, onSubmit }: { hero: Hero; onSubmit: (h: Hero) => void }) {
  const [surname, setSurname] = useState(hero.surname);
  const [name, setName] = useState(hero.name);
  return (
    <form
      className="comic-box space-y-4 bg-white p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (surname.trim()) onSubmit({ ...hero, surname: surname.trim(), name: name.trim() });
      }}
    >
      <h1 className="comic-title text-5xl">Who&apos;s the hero?</h1>
      <div className="space-y-1.5">
        <Label htmlFor="setup-surname" className="comic-title text-2xl">
          Surname
        </Label>
        <Input
          id="setup-surname"
          required
          autoFocus
          maxLength={40}
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          placeholder="e.g. Lim"
          className="h-14 text-2xl"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="setup-name" className="font-bold">
          First name (optional)
        </Label>
        <Input id="setup-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={!surname.trim()}>
        <SearchIcon /> Research my surname
      </Button>
    </form>
  );
}
