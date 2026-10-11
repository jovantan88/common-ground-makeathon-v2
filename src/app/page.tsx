import { BookOpenIcon, LandmarkIcon, MessageCircleQuestionIcon, ScrollTextIcon } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { Burst } from "@/components/comic/burst";
import { StoryCard } from "@/components/comic/story-card";
import { HeroForm } from "@/components/hero-form";
import { repo } from "@/lib/db";
import type { StorySummary } from "@/lib/schemas";

const STEPS = [
  {
    n: 1,
    title: "Type your surname",
    body: "Tan, Nguyen, Murphy, García… every name is a time capsule.",
    icon: ScrollTextIcon,
    color: "bg-pow",
  },
  {
    n: 2,
    title: "Uncover your roots",
    body: "Our AI historian traces its origins and the dialect groups or lineages that carried it. You pick yours.",
    icon: LandmarkIcon,
    color: "bg-blush",
  },
  {
    n: 3,
    title: "Star in the comic",
    body: "A writer AI scripts your ancestors' journey and an artist AI draws it, one comic page at a time. You choose what happens next — and learn real history.",
    icon: BookOpenIcon,
    color: "bg-jade",
  },
];

export default function Home() {
  return (
    <div className="overflow-x-clip">
      {/* ------------------------------ Hero ------------------------------ */}
      <section className="sunburst relative border-b-[3px] border-ink">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1.15fr_1fr]">
          <div className="relative space-y-6">
            <Burst
              className="absolute -top-8 right-0 hidden size-28 rotate-12 sm:inline-grid lg:-right-6"
              color="bg-zap"
              textClassName="text-2xl text-white"
            >
              New issue!
            </Burst>
            <span className="caption-box inline-block px-3 py-1 text-sm">Culture × Tech · An interactive history comic</span>
            <h1 className="comic-title text-[3.25rem] text-white text-outline sm:text-8xl">
              Every name
              <br />
              has a <span className="text-zap">story.</span>
              <br />
              Star in yours!
            </h1>
            <p className="max-w-lg border-[3px] border-ink bg-white p-4 text-lg font-bold shadow-comic">
              Type your surname. We&apos;ll dig up its history and dialect roots — then draw you into a comic of your
              ancestors&apos; journey across oceans and centuries.
            </p>
          </div>
          <div className="relative">
            <div
              className="speech absolute -top-10 -left-4 z-10 hidden -rotate-3 px-4 py-2 font-bold sm:block"
              data-tail="left"
            >
              Tan? Kim? Murphy? What&apos;s yours?
            </div>
            <HeroForm />
          </div>
        </div>
      </section>

      {/* ------------------------------ How it works ------------------------------ */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="comic-title text-center text-5xl sm:text-6xl">How it works</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className={`comic-box relative bg-white p-6 pt-10 ${i === 1 ? "md:translate-y-4 md:rotate-1" : "md:-rotate-1"}`}
            >
              <Burst className="absolute -top-8 -left-4 size-20" color={s.color} textClassName="text-4xl">
                {s.n}
              </Burst>
              <s.icon className="absolute top-4 right-4 size-7 text-ink/70" />
              <h3 className="comic-title text-3xl">{s.title}</h3>
              <p className="mt-2 text-lg">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-14 flex max-w-3xl items-start gap-4 border-[3px] border-ink bg-bam p-5 text-white shadow-comic halftone-light">
          <MessageCircleQuestionIcon className="mt-1 size-8 shrink-0 text-pow" />
          <p className="text-lg">
            <span className="comic-title mr-1 text-2xl text-pow">Why?</span>
            Many of us can&apos;t speak our grandparents&apos; dialect or say where our surname comes from. Surname
            Saga turns that heritage into an adventure — with history notes, words in your ancestral language and pop
            quizzes in every chapter.
          </p>
        </div>
      </section>

      {/* ------------------------------ Gallery ------------------------------ */}
      <section id="gallery" className="scroll-mt-20 border-t-[3px] border-ink bg-white/60 py-16">
        <Suspense fallback={<GallerySkeleton />}>
          <Gallery />
        </Suspense>
      </section>
    </div>
  );
}

async function Gallery() {
  await connection(); // the gallery is live data — never prerender it
  let stories: StorySummary[] = [];
  try {
    stories = await repo().listStories(24);
  } catch (err) {
    console.error("[home] failed to load gallery", err);
  }
  const featured = stories.filter((s) => s.isFeatured);
  const community = stories.filter((s) => !s.isFeatured);

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4">
      {featured.length > 0 && (
        <div>
          <h2 className="comic-title text-5xl">Featured sagas</h2>
          <p className="text-lg">Hand-picked journeys to read, learn from and remix.</p>
          <div className="mt-8 grid grid-cols-2 gap-5 sm:gap-8 md:grid-cols-3 lg:grid-cols-4">
            {featured.map((s, i) => (
              <StoryCard key={s.id} story={s} index={i} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="comic-title text-5xl">Fresh from the community</h2>
        <p className="text-lg">Sagas readers have shared. Yours could be next!</p>
        {community.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-5 sm:gap-8 md:grid-cols-3 lg:grid-cols-4">
            {community.map((s, i) => (
              <StoryCard key={s.id} story={s} index={i + 2} />
            ))}
          </div>
        ) : (
          <div className="comic-box halftone mt-8 bg-paper p-10 text-center">
            <p className="comic-title text-3xl">No shared sagas yet…</p>
            <p className="mt-1">Create one and hit “Share to gallery” to be the first!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <h2 className="comic-title text-5xl">Loading the gallery…</h2>
      <div className="mt-8 grid grid-cols-2 gap-5 sm:gap-8 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="comic-box pencil-sketch animate-ink aspect-[2/3]" />
        ))}
      </div>
    </div>
  );
}
