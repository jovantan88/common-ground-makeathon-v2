"use client";

import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
import { streamFacts } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Burst } from "./burst";

const TIP_COUNT = 10;

/** Shown if the live tip stream is unavailable. */
const FALLBACK_TIPS = [
  "Wang, Li and Zhang are each shared by roughly 100 million people — the most common surnames on Earth.",
  "Chinese family names are among the oldest in the world, with some traced back over 3,000 years.",
  "Smith is the most common surname in the English-speaking world — it comes from blacksmiths and metalworkers.",
  "Iceland still mostly uses patronymics: Jónsdóttir simply means 'Jón's daughter'.",
  "Kim, Lee and Park together are shared by nearly half of all South Koreans.",
  "Most Japanese commoners only took surnames after an 1875 law required everyone to have one.",
];

export function LoadingComic({
  title,
  steps,
  children,
  className,
}: {
  title: string;
  steps?: { label: string; done: boolean }[];
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("comic-box sunburst relative overflow-hidden p-5 sm:p-8", className)}>
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Burst className="size-28 shrink-0 animate-wiggle sm:size-32" color="bg-zap" textClassName="text-2xl text-white">
          Please wait!
        </Burst>
        <div className="space-y-3">
          <h2 className="comic-title text-4xl text-white text-outline sm:text-5xl">{title}</h2>
          {steps && (
            <ul className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {steps.map((s) => (
                <li
                  key={s.label}
                  className={cn(
                    "inline-flex items-center gap-1.5 border-[2.5px] border-ink px-2.5 py-1 text-sm font-bold shadow-comic-sm",
                    s.done ? "bg-jade text-white" : "bg-white"
                  )}
                >
                  {s.done ? <CheckIcon className="size-4" /> : <Loader2Icon className="size-4 animate-spin" />}
                  {s.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Ten tips streamed from a fast model while the main model works — one shown at
 * a time, with numbered buttons to flip between them. Key the component to
 * restart the stream for a new topic.
 */
export function TipsDeck({
  surname,
  heritage,
  avoid,
  onFacts,
}: {
  surname: string;
  heritage?: { name: string; homeland: string } | null;
  avoid?: string[];
  onFacts?: (facts: string[]) => void;
}) {
  const [tips, setTips] = useState<string[]>([]);
  const [typing, setTyping] = useState("");
  const [status, setStatus] = useState<"streaming" | "done" | "failed">("streaming");
  const [selected, setSelected] = useState(0);
  const report = useEffectEvent((f: string[]) => onFacts?.(f));
  const heritageName = heritage?.name;
  const homeland = heritage?.homeland;

  useEffect(() => {
    const ctrl = new AbortController();
    let latest: string[] = [];
    streamFacts(
      { surname, heritage: heritageName && homeland ? { name: heritageName, homeland } : null, avoid },
      (finished, current) => {
        latest = finished.slice(0, TIP_COUNT);
        setTips(latest);
        setTyping(latest.length >= TIP_COUNT ? "" : current);
      },
      ctrl.signal
    )
      .then(() => {
        setStatus(latest.length ? "done" : "failed");
        report(latest);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setStatus(latest.length ? "done" : "failed");
      });
    return () => ctrl.abort();
  }, [surname, heritageName, homeland, avoid]);

  const shown = status === "failed" && tips.length === 0 ? FALLBACK_TIPS : tips;
  // Slots 1–10: finished tips are clickable; the one being written pulses; the rest wait.
  const slots = status === "streaming" ? TIP_COUNT : shown.length;
  const index = Math.min(selected, Math.max(0, shown.length - 1));
  const writingThis = index === shown.length && !!typing;
  const text = shown[index] ?? (typing && index === shown.length ? typing : "");

  return (
    <div className="mt-6">
      <p className="comic-title flex items-center gap-2 text-2xl text-white text-outline-sm">
        <SparklesIcon className="size-5 text-white" /> Did you know?
        {status === "streaming" && (
          <span className="ml-1 inline-flex items-center gap-1 border-2 border-ink bg-zap px-1.5 py-0.5 font-sans text-[10px] font-bold tracking-widest text-white">
            <span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE
          </span>
        )}
      </p>

      <div key={index} className="speech animate-pop-in mt-5 flex min-h-24 items-center gap-3 px-5 py-4" data-tail="left">
        <span className="comic-title shrink-0 text-4xl leading-none text-zap">#{index + 1}</span>
        <p className="text-[17px] leading-snug font-bold">
          {text || "Our fact-finder is flipping through the archives…"}
          {writingThis && <span className="ml-0.5 inline-block w-2 animate-pulse">▌</span>}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
        <button
          type="button"
          aria-label="Previous tip"
          disabled={index === 0}
          onClick={() => setSelected(index - 1)}
          className="grid size-9 place-items-center border-[2.5px] border-ink bg-white shadow-comic-sm transition-transform hover:-translate-y-0.5 disabled:opacity-40"
        >
          <ChevronLeftIcon className="size-5" />
        </button>
        {Array.from({ length: slots }, (_, i) => {
          const ready = i < shown.length;
          return (
            <button
              key={i}
              type="button"
              disabled={!ready}
              aria-label={`Tip ${i + 1}`}
              aria-current={i === index}
              onClick={() => setSelected(i)}
              className={cn(
                "comic-title grid size-9 place-items-center border-[2.5px] border-ink text-lg leading-none shadow-comic-sm transition-all",
                i === index ? "-translate-y-0.5 bg-zap text-white" : ready ? "bg-white hover:-translate-y-0.5 hover:bg-pow" : "bg-white/50 text-ink/40 shadow-none",
                !ready && i === shown.length && "animate-pulse"
              )}
            >
              {i + 1}
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Next tip"
          disabled={index >= shown.length - 1}
          onClick={() => setSelected(index + 1)}
          className="grid size-9 place-items-center border-[2.5px] border-ink bg-white shadow-comic-sm transition-transform hover:-translate-y-0.5 disabled:opacity-40"
        >
          <ChevronRightIcon className="size-5" />
        </button>
      </div>
    </div>
  );
}
