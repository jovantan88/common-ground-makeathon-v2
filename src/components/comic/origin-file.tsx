import { FolderOpenIcon, InfoIcon, SparklesIcon, StarIcon } from "lucide-react";
import type { Research } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/** "The Origin File": the researched history of a surname, styled as a case file. */
export function OriginFile({ research, compact = false }: { research: Research; compact?: boolean }) {
  const hanzi = research.nativeScript.split(/[\s(（]/)[0];

  return (
    <section className="comic-box relative bg-white">
      <div className="flex items-center gap-2 border-b-[3px] border-ink bg-ink px-4 py-2 text-paper">
        <FolderOpenIcon className="size-5 text-pow" />
        <h2 className="comic-title text-2xl tracking-wider">
          The Origin File: <span className="text-pow">{research.surname}</span>
        </h2>
      </div>

      <div className={cn("grid gap-6 p-4 sm:p-6", !compact && "md:grid-cols-[auto_1fr]")}>
        <div className="flex flex-col items-center gap-3">
          <div className="sunburst grid size-36 place-items-center border-[3px] border-ink shadow-comic">
            <span className={cn("leading-none text-ink", hanzi ? "font-brush text-8xl" : "comic-title text-5xl")}>
              {hanzi || research.surname.slice(0, 3)}
            </span>
          </div>
          {research.nativeScript && <p className="text-sm font-bold">{research.nativeScript}</p>}
          <div className="flex max-w-56 flex-wrap justify-center gap-1.5">
            {research.romanizations.slice(0, 6).map((r) => (
              <span key={r.label + r.spelling} className="border-2 border-ink bg-paper px-1.5 py-0.5 text-xs font-bold">
                {r.label}: <span className="text-zap">{r.spelling}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="comic-title text-xl text-zap">What it means</h3>
            <p>{research.meaning}</p>
          </div>
          <div>
            <h3 className="comic-title text-xl text-zap">Where it began</h3>
            <p>{research.originStory}</p>
          </div>

          {!compact && (
            <>
              <div>
                <h3 className="comic-title text-xl text-zap">Through the ages</h3>
                <ol className="mt-2 space-y-2 border-l-[3px] border-ink pl-4">
                  {research.timeline.map((t) => (
                    <li key={t.era} className="relative">
                      <span className="absolute top-1.5 -left-[23px] size-3 rounded-full border-2 border-ink bg-pow" />
                      <span className="font-bold">{t.era}:</span> {t.event}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {research.famousBearers.length > 0 && (
                  <div className="border-[2.5px] border-ink bg-paper p-3">
                    <h3 className="comic-title flex items-center gap-1.5 text-lg">
                      <StarIcon className="size-4 fill-pow" /> Famous {research.surname}s
                    </h3>
                    <ul className="mt-1 space-y-1 text-sm">
                      {research.famousBearers.map((b) => (
                        <li key={b.name}>
                          <span className="font-bold">{b.name}</span> — {b.note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="border-[2.5px] border-ink bg-paper p-3">
                  <h3 className="comic-title flex items-center gap-1.5 text-lg">
                    <SparklesIcon className="size-4 text-zap" /> Fun facts
                  </h3>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                    {research.funFacts.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}

          <p className="flex gap-2 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
            {research.caveat}
          </p>
        </div>
      </div>
    </section>
  );
}
