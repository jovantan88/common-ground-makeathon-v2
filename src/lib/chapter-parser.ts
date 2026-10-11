import type { AISheet } from "./schemas";

export type ChapterMeta = {
  chapterTitle: string;
  place: string;
  year: string;
  act: number;
  recap: string;
  heroOutfit: string;
};

export type ChapterStreamEvent =
  | { type: "meta"; meta: ChapterMeta }
  | { type: "sheet"; index: number; sheet: AISheet };

/**
 * Incrementally pulls complete comic pages (sheets) out of a chapter's JSON
 * while the model is still writing it. Structured outputs emit keys in schema
 * order, so the chapter meta arrives first, then each sheet object, then the extras.
 */
export function createChapterParser() {
  let buf = "";
  let sheetsStart = -1;
  let pos = 0;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objStart = -1;
  let sheetsDone = false;
  let count = 0;

  return function push(delta: string): ChapterStreamEvent[] {
    buf += delta;
    const events: ChapterStreamEvent[] = [];

    if (sheetsStart < 0) {
      const m = /"sheets"\s*:\s*\[/.exec(buf);
      if (!m) return events;
      sheetsStart = pos = m.index + m[0].length;
      try {
        const meta = JSON.parse(buf.slice(0, m.index).replace(/,\s*$/, "") + "}");
        events.push({ type: "meta", meta });
      } catch {
        /* meta is optional for the client — the final chapter carries it too */
      }
    }

    for (; !sheetsDone && pos < buf.length; pos++) {
      const c = buf[pos];
      if (inString) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === "{") {
        if (depth === 0) objStart = pos;
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth === 0 && objStart >= 0) {
          try {
            events.push({ type: "sheet", index: count, sheet: JSON.parse(buf.slice(objStart, pos + 1)) });
            count++;
          } catch {
            /* skip a malformed sheet; the final parse is authoritative */
          }
          objStart = -1;
        }
      } else if (c === "]" && depth === 0) {
        sheetsDone = true;
      }
    }
    return events;
  };
}
