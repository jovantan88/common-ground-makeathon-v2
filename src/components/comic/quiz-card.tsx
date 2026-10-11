"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { Page } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { Burst } from "./burst";

export function QuizCard({ quiz, onAnswer }: { quiz: Page["quiz"]; onAnswer?: (correct: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const correct = picked === quiz.answerIndex;

  return (
    <div className="relative border-[3px] border-ink bg-white p-4 pt-6 shadow-comic-sm">
      <Burst className="absolute -top-6 -left-3 size-20 -rotate-12" color="bg-zap" textClassName="text-lg text-white">
        Pop quiz!
      </Burst>
      <p className="pl-16 font-bold sm:text-lg">{quiz.question}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {quiz.options.map((opt, i) => {
          const isAnswer = i === quiz.answerIndex;
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => {
                setPicked(i);
                onAnswer?.(i === quiz.answerIndex);
              }}
              className={cn(
                "flex items-start gap-2 border-[2.5px] border-ink bg-paper px-3 py-2 text-left text-sm font-bold transition-all",
                !answered && "hover:-translate-y-0.5 hover:bg-pow hover:shadow-comic-sm",
                answered && isAnswer && "bg-jade text-white",
                answered && picked === i && !isAnswer && "bg-zap text-white",
                answered && picked !== i && !isAnswer && "opacity-50"
              )}
            >
              <span className="comic-title text-lg leading-none">{String.fromCharCode(65 + i)}</span>
              <span className="flex-1">{opt}</span>
              {answered && isAnswer && <CheckIcon className="size-4 shrink-0" />}
              {answered && picked === i && !isAnswer && <XIcon className="size-4 shrink-0" />}
            </button>
          );
        })}
      </div>
      {answered && (
        <p className="mt-3 animate-pop-in text-sm">
          <span className={cn("comic-title mr-2 text-xl", correct ? "text-jade" : "text-zap")}>
            {correct ? "Correct!" : "Not quite!"}
          </span>
          {quiz.explanation}
        </p>
      )}
    </div>
  );
}
