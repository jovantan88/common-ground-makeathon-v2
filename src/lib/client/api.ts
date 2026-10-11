"use client";

import { nanoid } from "nanoid";
import type { ChapterMeta, ChapterStreamEvent } from "@/lib/chapter-parser";
import type {
  AIChapter,
  AISheet,
  ArtDirection,
  HeritageOption,
  Hero,
  Outline,
  Page,
  Research,
  Sheet,
  Story,
} from "@/lib/schemas";

export async function postJSON<T>(url: string, body: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

/* ---------------- ownership (who may continue a saga) ---------------- */

const OWNED_KEY = "saga:owned";

function readOwned(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(OWNED_KEY) || "{}");
  } catch {
    return {};
  }
}

export function getOwnerToken(storyId: string): string | null {
  return readOwned()[storyId] ?? null;
}

export function setOwnerToken(storyId: string, token: string) {
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify({ ...readOwned(), [storyId]: token }));
  } catch {
    /* private mode — ownership lasts for this tab only */
  }
}

export const newStoryId = () => nanoid(12);
export const newOwnerToken = () => nanoid(32);
export const newSheet = (s: AISheet): Sheet => ({ ...s, id: nanoid(10), imageUrl: null, art: null });

/* ---------------- story helpers ---------------- */

export function saveStory(story: Story, ownerToken: string) {
  // Chapters still being written are never persisted.
  const pages = story.pages.filter((p) => !p.streaming);
  return postJSON<{ ok: true }>(`/api/stories/${story.id}`, { story: { ...story, pages }, ownerToken }, "PUT");
}

/** An empty chapter shell that fills in as the writer streams. */
export function draftChapter(prompt: string | null): Page {
  return {
    id: nanoid(10),
    streaming: true,
    prompt,
    chapterTitle: "",
    place: "",
    year: "",
    act: 0,
    recap: "",
    heroOutfit: "",
    sheets: [],
    historyNote: { title: "", body: "" },
    dialectWord: null,
    quiz: { question: "", options: [], answerIndex: 0, explanation: "" },
    choices: [],
    isFinale: false,
  };
}

/** Merge the finished chapter into its draft, keeping page ids, art plans and any images already drawn. */
export function finalizeChapter(draft: Page, ai: AIChapter): Page {
  const sheets = ai.sheets.map((s, i) => {
    const prev = draft.sheets[i];
    return prev ? { ...s, id: prev.id, imageUrl: prev.imageUrl, art: prev.art } : newSheet(s);
  });
  const quiz = { ...ai.quiz, options: ai.quiz.options.slice(0, 4) };
  quiz.answerIndex = Math.min(Math.max(0, quiz.answerIndex), quiz.options.length - 1);
  return { ...ai, id: draft.id, prompt: draft.prompt, sheets, quiz, choices: ai.choices.slice(0, 3) };
}

/** Stream the next chapter; handlers fire as the meta and each comic page arrive. */
export async function streamChapter(
  story: Story,
  prompt: string | null,
  on: { meta: (m: ChapterMeta) => void; sheet: (s: AISheet, index: number) => void },
  signal?: AbortSignal
): Promise<AIChapter> {
  const pages = story.pages.filter((p) => !p.streaming);
  const res = await fetch("/api/story/chapter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ story: { ...story, pages }, prompt }),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  let chapter: AIChapter | null = null;
  for await (const line of readLines(res.body)) {
    const event = JSON.parse(line) as
      | ChapterStreamEvent
      | { type: "chapter"; chapter: AIChapter }
      | { type: "error"; message: string };
    if (event.type === "meta") on.meta(event.meta);
    else if (event.type === "sheet") on.sheet(event.sheet, event.index);
    else if (event.type === "chapter") chapter = event.chapter;
    else if (event.type === "error") throw new Error(event.message);
  }
  if (!chapter) throw new Error("The chapter got cut off. Please try again.");
  return chapter;
}

/** Decode a byte stream into text chunks as they arrive. */
async function* readText(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
  const tail = decoder.decode();
  if (tail) yield tail;
}

async function* readLines(body: ReadableStream<Uint8Array>) {
  let buf = "";
  for await (const chunk of readText(body)) {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) yield line;
    }
  }
  if (buf.trim()) yield buf.trim();
}

/** Stream fun facts (one per line); `onUpdate` gets the finished facts plus the one being typed. */
export async function streamFacts(
  body: { surname: string; heritage?: { name: string; homeland: string } | null; avoid?: string[] },
  onUpdate: (facts: string[], typing: string) => void,
  signal?: AbortSignal
) {
  const res = await fetch("/api/facts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) return;
  let text = "";
  const clean = (s: string) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
  for await (const chunk of readText(res.body)) {
    text += chunk;
    const lines = text.split("\n");
    const typing = lines.pop() ?? "";
    onUpdate(lines.map(clean).filter(Boolean), clean(typing));
  }
  onUpdate(text.split("\n").map(clean).filter(Boolean), "");
}

export function requestCover(storyId: string, hero: Hero, heritage: HeritageOption, research: Research) {
  return postJSON<{ url: string }>("/api/image", { kind: "cover", storyId, hero, heritage, research });
}

/** The cast model sheet: every recurring character side by side, used as an art reference for each page. */
export function requestCastSheet(storyId: string, outline: Outline, heritage: HeritageOption) {
  return postJSON<{ url: string }>("/api/image", {
    kind: "cast",
    storyId,
    homeland: heritage.homeland,
    cast: outline.cast,
  });
}

/* ---------------- drawing comic pages (the artist AI) ---------------- */

/** Every comic page in reading order, across chapters. */
export const allSheets = (story: Story) => story.pages.flatMap((page) => page.sheets.map((sheet) => ({ page, sheet })));

function previousSheet(story: Story, sheetId: string) {
  const all = allSheets(story);
  const i = all.findIndex((x) => x.sheet.id === sheetId);
  return i > 0 ? all[i - 1] : null;
}

/** The script of one comic page without the app-only fields (what the artist AIs are sent). */
const script = (sheet: Sheet): AISheet => ({ format: sheet.format, panels: sheet.panels });

const castOnPage = (story: Story, sheet: Sheet) => {
  const names = new Set(sheet.panels.flatMap((p) => p.cast ?? []).map((n) => n.toLowerCase()));
  return (story.outline?.cast ?? []).filter((c) => names.has(c.name.toLowerCase()));
};

/** Step 1 — the art director plans the page: layout, locations, staging and where each balloon points. */
export async function directSheet(story: Story, page: Page, sheet: Sheet): Promise<ArtDirection> {
  const onPage = new Set(castOnPage(story, sheet).map((c) => c.name));
  const castBible = (story.outline?.cast ?? [])
    .map((c) => ({ c, on: onPage.has(c.name) }))
    .sort((a, b) => Number(b.on) - Number(a.on))
    .slice(0, 8)
    .map(({ c, on }) => `${c.name} (${c.role})${on ? " [on this page]" : ""}: ${c.look}`);
  const prev = previousSheet(story, sheet.id);
  const previous = (prev?.sheet.panels ?? []).map((p) => `${p.setting}: ${p.scene}`);

  const { art } = await postJSON<{ art: ArtDirection }>("/api/sheet/direct", {
    hero: story.hero,
    heritage: story.heritage,
    culture: story.research.culture,
    heroOutfit: page.heroOutfit ?? "",
    castBible,
    previous,
    sheet: script(sheet),
  });
  return art;
}

/**
 * Step 2 — the illustrator paints the whole page (every panel, balloon and caption) in one image,
 * looking at the hero's cover, the cast model sheet and the previous page so everyone stays on-model.
 */
export async function drawSheet(story: Story, page: Page, sheet: Sheet): Promise<{ url: string }> {
  if (!sheet.art) throw new Error("This page has no art plan yet.");
  const prev = previousSheet(story, sheet.id);
  return postJSON<{ url: string }>("/api/sheet/draw", {
    storyId: story.id,
    hero: story.hero,
    heritage: story.heritage,
    culture: story.research.culture,
    heroOutfit: page.heroOutfit ?? "",
    cast: castOnPage(story, sheet).map(({ name, role, look }) => ({ name, role, look })),
    sheet: script(sheet),
    art: sheet.art,
    refs: { cover: story.coverUrl, cast: story.castUrl, previous: prev?.sheet.imageUrl ?? null },
  });
}
