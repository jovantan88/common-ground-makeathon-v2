"use client";

import { ClapperboardIcon, PaletteIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Sheet } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export type SheetStatus = "ready" | "directing" | "drawing" | "queued" | "failed" | "idle";

/** Plain-text version of everything said on the page, for screen readers. */
function transcript(sheet: Sheet) {
  return sheet.panels
    .map((p, i) =>
      [`Panel ${i + 1}.`, p.caption, ...p.dialogue.map((d) => `${d.speaker}: ${d.text}`)].filter(Boolean).join(" ")
    )
    .join(" ");
}

/** One comic page — a single illustration holding several panels, lettering and all. */
export function ComicSheet({
  sheet,
  number,
  total,
  status,
  onRetry,
  onRedraw,
}: {
  sheet: Sheet;
  number: number;
  total: number;
  status: SheetStatus;
  onRetry?: () => void;
  /** Owner only: paint this page again (e.g. to fix a misspelled word). */
  onRedraw?: () => void;
}) {
  const portrait = sheet.format !== "landscape";
  return (
    <figure className={cn("mx-auto w-full animate-pop-in", portrait ? "sm:max-w-[760px]" : "max-w-full")}>
      <div
        className={cn(
          "relative overflow-hidden border-[3px] border-ink bg-paper",
          portrait ? "aspect-[2/3]" : "aspect-[3/2]"
        )}
      >
        {sheet.imageUrl ? (
          <Dialog>
            <DialogTrigger asChild>
              <button type="button" className="absolute inset-0 cursor-zoom-in" aria-label="Enlarge this comic page">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sheet.imageUrl}
                  alt={transcript(sheet)}
                  className="size-full animate-pop-in object-cover"
                  loading="lazy"
                />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-[min(96vw,1100px)] border-[3px] border-ink bg-ink p-1 sm:max-w-[min(96vw,1100px)]">
              <DialogTitle className="sr-only">Comic page {number}</DialogTitle>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sheet.imageUrl} alt={transcript(sheet)} className="max-h-[90vh] w-full object-contain" />
            </DialogContent>
          </Dialog>
        ) : (
          <SheetPlaceholder sheet={sheet} status={status} onRetry={onRetry} />
        )}
      </div>
      {(total > 1 || (onRedraw && sheet.imageUrl)) && (
        <figcaption className="mt-1 flex items-center justify-end gap-3 text-xs font-bold tracking-wider text-muted-foreground uppercase">
          {onRedraw && sheet.imageUrl && (
            <button
              type="button"
              onClick={onRedraw}
              className="inline-flex items-center gap-1 hover:text-zap"
              title="Spotted a typo or a wonky face? Paint this page again."
            >
              <RotateCcwIcon className="size-3.5" /> Redraw this page
            </button>
          )}
          {total > 1 && (
            <span>
              Page {number} / {total}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}

function SheetPlaceholder({
  sheet,
  status,
  onRetry,
}: {
  sheet: Sheet;
  status: SheetStatus;
  onRetry?: () => void;
}) {
  const label = {
    directing: { icon: ClapperboardIcon, text: "Art director is planning the page…" },
    drawing: { icon: PaletteIcon, text: "Illustrator is drawing the page…" },
    queued: { icon: PaletteIcon, text: "Waiting for the artist…" },
    idle: { icon: PaletteIcon, text: "Page not drawn yet" },
    ready: { icon: PaletteIcon, text: "" },
    failed: { icon: PaletteIcon, text: "" },
  }[status];

  return (
    <div className="pencil-sketch animate-ink absolute inset-0 flex flex-col gap-3 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-center gap-3 text-center">
        {status === "failed" ? (
          <>
            <p className="comic-title text-2xl text-zap sm:text-3xl">The ink spilled!</p>
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RotateCcwIcon /> Redraw
              </Button>
            )}
          </>
        ) : (
          <p className="comic-title flex items-center gap-2 text-xl sm:text-2xl">
            <label.icon className={cn("size-6 shrink-0", status !== "idle" && "animate-wiggle")} />
            {label.text}
          </p>
        )}
      </div>

      {/* The script, so the reader can follow along while the art is made. */}
      <ol className="mx-auto w-full max-w-xl space-y-2.5 text-sm">
        {sheet.panels.map((p, i) => (
          <li key={i} className="border-2 border-ink/70 bg-white/80 p-2">
            <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              Panel {i + 1} · {p.setting}
            </p>
            {p.caption && <p className="caption-box mt-1 px-2 py-1 text-xs">{p.caption}</p>}
            {p.dialogue.map((d, j) => (
              <p key={j} className="mt-1">
                <span className="text-[10px] font-bold tracking-wider text-zap uppercase">{d.speaker}</span>{" "}
                <span className="font-bold">“{d.text}”</span>
              </p>
            ))}
          </li>
        ))}
      </ol>
    </div>
  );
}
