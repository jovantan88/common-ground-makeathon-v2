"use client";

import { MapPinIcon, PencilIcon, ScrollTextIcon } from "lucide-react";
import type { HeritageOption, Page, Sheet } from "@/lib/schemas";
import { ComicSheet, type SheetStatus } from "./comic-sheet";
import { QuizCard } from "./quiz-card";

/** One chapter: its comic pages, then the history note, a word in the ancestral language, and a quiz. */
export function ComicPage({
  page,
  index,
  heritage,
  sheetStatus,
  onRetrySheet,
  onRedrawSheet,
  onQuizAnswer,
}: {
  page: Page;
  index: number;
  heritage: HeritageOption;
  sheetStatus: (sheet: Sheet) => SheetStatus;
  onRetrySheet?: (sheet: Sheet) => void;
  onRedrawSheet?: (sheet: Sheet) => void;
  onQuizAnswer?: (correct: boolean) => void;
}) {
  return (
    <article id={`page-${index + 1}`} className="comic-box scroll-mt-24 bg-white p-3 sm:p-5">
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="caption-box px-2.5 py-0.5 text-sm">Chapter {index + 1}</span>
        <h2 className="comic-title flex-1 text-3xl sm:text-4xl">
          {page.chapterTitle || (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <PencilIcon className="size-6 animate-wiggle" /> Writing…
            </span>
          )}
        </h2>
        {page.place && (
          <span className="inline-flex items-center gap-1 border-2 border-ink bg-paper px-2 py-0.5 text-xs font-bold">
            <MapPinIcon className="size-3.5" />
            {page.place} · {page.year}
          </span>
        )}
      </header>

      {page.recap && (
        <p className="caption-box mb-4 px-3 py-2 text-sm normal-case">
          <span className="comic-title mr-2 text-lg tracking-wider uppercase">
            {index === 0 ? "Our story:" : "Previously…"}
          </span>
          {page.recap}
        </p>
      )}

      <div className="flex flex-col gap-4 sm:gap-5">
        {page.sheets.map((sheet, i) => (
          <ComicSheet
            key={sheet.id}
            sheet={sheet}
            number={i + 1}
            total={page.sheets.length}
            status={sheetStatus(sheet)}
            onRetry={onRetrySheet ? () => onRetrySheet(sheet) : undefined}
            onRedraw={onRedrawSheet && !page.streaming ? () => onRedrawSheet(sheet) : undefined}
          />
        ))}

        {page.streaming && (
          <div className="pencil-sketch animate-ink flex items-center justify-center gap-3 border-[3px] border-dashed border-ink/50 px-4 py-8 text-center">
            <PencilIcon className="size-6 animate-wiggle" />
            <p className="comic-title text-2xl">
              {page.sheets.length ? `Writing page ${page.sheets.length + 1}…` : "Sketching the first page…"}
            </p>
          </div>
        )}
      </div>

      {!page.streaming && (
        <>
          <div className="mt-5 grid gap-4 md:grid-cols-5">
            <section className="relative border-[3px] border-ink bg-pow p-4 shadow-comic-sm md:col-span-3">
              <h3 className="comic-title flex items-center gap-2 text-2xl">
                <ScrollTextIcon className="size-5" /> Did you know?
              </h3>
              <p className="mt-1 font-bold">{page.historyNote.title.replace(/^did you know\??[:\s—-]*/i, "")}</p>
              <p className="mt-1 text-[15px] leading-relaxed">{page.historyNote.body}</p>
            </section>

            {page.dialectWord ? (
              <section className="halftone-light relative min-w-0 border-[3px] border-ink bg-bam p-4 text-white shadow-comic-sm [overflow-wrap:anywhere] md:col-span-2">
                <h3 className="comic-title text-2xl text-pow text-outline-sm">
                  Say it in {page.dialectWord.language || heritage.name}!
                </h3>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {page.dialectWord.script && (
                    <bdi dir="auto" className="min-w-0 max-w-full font-surname text-3xl leading-relaxed">
                      {page.dialectWord.script}
                    </bdi>
                  )}
                  <bdi dir="auto" className="min-w-0 max-w-full font-surname text-xl font-bold">
                    {page.dialectWord.term}
                  </bdi>
                </div>
                <p className="mt-2 text-[15px]">{page.dialectWord.meaning}</p>
              </section>
            ) : (
              <section className="halftone relative grid place-items-center border-[3px] border-ink bg-paper p-4 text-center shadow-comic-sm md:col-span-2">
                <p className="comic-title text-2xl">
                  {page.place}
                  <span className="block text-4xl text-zap">{page.year}</span>
                </p>
              </section>
            )}
          </div>

          {page.quiz.options.length > 0 && (
            <div className="mt-8">
              <QuizCard quiz={page.quiz} onAnswer={onQuizAnswer} />
            </div>
          )}
        </>
      )}
    </article>
  );
}
