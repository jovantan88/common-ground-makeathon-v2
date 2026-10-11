#!/usr/bin/env node
/**
 * Build featured "preset" sagas that ship with the app (and are auto-seeded
 * into Neon as featured stories).
 *
 * Requires the dev server to be running (npm run dev).
 *
 *   node scripts/make-preset.mjs generate --surname Lim --heritage teochew \
 *        --name "Wei Ling" --pronouns she --home Singapore --chapters 2
 *   node scripts/make-preset.mjs export <storyId>      # turn an existing saga into a preset
 *
 * Options: --base http://localhost:3000   --look "short hair, glasses"   --home "Toronto"
 *          --prompts "first choice|second choice"   (otherwise picks choice #1 each time)
 */
import { randomBytes } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRESET_DIR = path.join(ROOT, "src/data/presets");
const IMAGE_DIR = path.join(ROOT, "public/presets");

const [cmd, ...rest] = process.argv.slice(2);
const args = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) args[rest[i].slice(2)] = rest[++i];
  else positional.push(rest[i]);
}
const BASE = args.base || process.env.BASE_URL || "http://localhost:3000";
const log = (...m) => console.log(`[${args.surname || positional[0] || "preset"}]`, ...m);

async function api(url, body, method = "POST") {
  const res = await fetch(BASE + url, {
    method: body ? method : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${url}: ${data.error || res.status}`);
  return data;
}

const rid = (n = 10) => randomBytes(n).toString("base64url").slice(0, n);

function newSheet(sh) {
  return { ...sh, id: rid(), imageUrl: null, art: null };
}

function toChapter(ai, prompt) {
  const quiz = { ...ai.quiz, options: ai.quiz.options.slice(0, 4) };
  quiz.answerIndex = Math.min(Math.max(0, quiz.answerIndex), quiz.options.length - 1);
  return { ...ai, sheets: ai.sheets.map(newSheet), quiz, choices: ai.choices.slice(0, 3), id: rid(), prompt };
}

/** Stream a chapter from the API and return the finished chapter (mirrors the browser). */
async function writeChapter(story, prompt) {
  const res = await fetch(BASE + "/api/story/chapter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ story, prompt }),
  });
  if (!res.ok || !res.body) throw new Error(`chapter: ${res.status} ${await res.text()}`);
  const decoder = new TextDecoder();
  let buf = "";
  let chapter = null;
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const ev = JSON.parse(line);
      if (ev.type === "sheet") process.stdout.write(".");
      if (ev.type === "chapter") chapter = ev.chapter;
      if (ev.type === "error") throw new Error(ev.message);
    }
  }
  process.stdout.write("\n");
  if (!chapter) throw new Error("chapter stream ended early");
  return toChapter(chapter, prompt);
}

/* ---- the artist AI: mirrors directSheet()/drawSheet() in src/lib/client/api.ts ---- */

const allSheets = (story) => story.pages.flatMap((page) => page.sheets.map((sheet) => ({ page, sheet })));
const script = (sheet) => ({ format: sheet.format, panels: sheet.panels });
const previousSheet = (story, id) => {
  const all = allSheets(story);
  const i = all.findIndex((x) => x.sheet.id === id);
  return i > 0 ? all[i - 1] : null;
};
const castOnPage = (story, sheet) => {
  const names = new Set(sheet.panels.flatMap((p) => p.cast ?? []).map((n) => n.toLowerCase()));
  return (story.outline?.cast ?? []).filter((c) => names.has(c.name.toLowerCase()));
};

async function directSheet(story, page, sheet) {
  const on = new Set(castOnPage(story, sheet).map((c) => c.name));
  const castBible = (story.outline?.cast ?? [])
    .map((c) => ({ c, on: on.has(c.name) }))
    .sort((a, b) => Number(b.on) - Number(a.on))
    .slice(0, 8)
    .map(({ c, on }) => `${c.name} (${c.role})${on ? " [on this page]" : ""}: ${c.look}`);
  const prev = previousSheet(story, sheet.id);
  const { art } = await api("/api/sheet/direct", {
    hero: story.hero,
    heritage: story.heritage,
    culture: story.research.culture,
    heroOutfit: page.heroOutfit ?? "",
    castBible,
    previous: (prev?.sheet.panels ?? []).map((p) => `${p.setting}: ${p.scene}`),
    sheet: script(sheet),
  });
  return art;
}

async function drawSheet(story, page, sheet) {
  const prev = previousSheet(story, sheet.id);
  const { url } = await api("/api/sheet/draw", {
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
  return url;
}

async function retrying(label, fn) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fn();
    } catch (e) {
      log(`${label} attempt ${attempt} failed: ${e.message}`);
    }
  }
  throw new Error(`${label} failed twice`);
}

/** Plan every new page up front, then paint them one at a time so each can look at the page before it. */
async function drawChapter(story, page) {
  await Promise.all(
    page.sheets.map(async (sheet) => {
      sheet.art = await retrying(`plan page ${page.sheets.indexOf(sheet) + 1}`, () => directSheet(story, page, sheet));
    })
  );
  for (const [i, sheet] of page.sheets.entries()) {
    log(`  painting page ${i + 1}/${page.sheets.length} (${sheet.panels.length} panels, ${sheet.format})…`);
    sheet.imageUrl = await retrying(`paint page ${i + 1}`, () => drawSheet(story, page, sheet));
  }
}

async function generate() {
  if (!args.surname) throw new Error("--surname is required");
  const hero = {
    name: args.name || "",
    surname: args.surname,
    pronouns: args.pronouns || "they",
    look: args.look || "",
    home: args.home || "",
  };
  const chapters = Number(args.chapters || args.pages || 2);
  const prompts = (args.prompts || "").split("|").filter(Boolean);

  log("researching…");
  const { research } = await api("/api/research", { surname: hero.surname });
  const heritage =
    research.heritageOptions.find(
      (h) => h.id === args.heritage || h.name.toLowerCase() === args.heritage?.toLowerCase()
    ) ?? research.heritageOptions[0];
  log(`heritage: ${heritage.name}`);

  const id = `preset-${hero.surname}-${heritage.id}`.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 40);
  log("plotting the saga + painting cover…");
  const [{ outline }, cover] = await Promise.all([
    api("/api/story/outline", { hero, heritage, research }),
    api("/api/image", { kind: "cover", storyId: id, hero, heritage, research }),
  ]);
  log("sketching the cast model sheet…");
  const cast = await api("/api/image", { kind: "cast", storyId: id, homeland: heritage.homeland, cast: outline.cast });
  const now = new Date().toISOString();
  const story = {
    id,
    version: 1,
    hero,
    heritage,
    research,
    outline,
    title: outline.title,
    tagline: outline.tagline,
    coverUrl: cover.url,
    castUrl: cast.url,
    pages: [],
    isPublic: true,
    createdAt: now,
    updatedAt: now,
  };
  log(`"${story.title}" — ${outline.acts.map((a) => a.place).join(" → ")}`);

  for (let n = 1; n <= chapters; n++) {
    const last = story.pages[story.pages.length - 1];
    const prompt = n === 1 ? null : prompts[n - 2] || last.choices[0];
    log(`chapter ${n}${prompt ? `: "${prompt}"` : ""}`);
    const page = await writeChapter(story, prompt);
    story.pages.push(page);
    log(`  "${page.chapterTitle}" — ${page.sheets.length} pages`);
    await drawChapter(story, page);
  }

  await exportStory(story);
}

async function download(url, file) {
  const res = await fetch(BASE + url);
  if (!res.ok) throw new Error(`download ${url}: ${res.status}`);
  await writeFile(path.join(IMAGE_DIR, file), Buffer.from(await res.arrayBuffer()));
  return `/presets/${file}`;
}

async function exportStory(story) {
  await mkdir(IMAGE_DIR, { recursive: true });
  const id = args.id || (story.id.startsWith("preset-") ? story.id : `preset-${story.id}`);
  const out = { ...story, id, isPublic: true, isFeatured: true };
  if (out.coverUrl?.startsWith("/api/")) out.coverUrl = await download(out.coverUrl, `${id}-cover.webp`);
  if (out.castUrl?.startsWith("/api/")) out.castUrl = await download(out.castUrl, `${id}-cast.webp`);
  for (const [pi, page] of out.pages.entries()) {
    for (const [si, sheet] of page.sheets.entries()) {
      if (sheet.imageUrl?.startsWith("/api/")) {
        sheet.imageUrl = await download(sheet.imageUrl, `${id}-c${pi + 1}-p${si + 1}.webp`);
      }
    }
  }
  await writeFile(path.join(PRESET_DIR, `${id}.json`), JSON.stringify(out, null, 2) + "\n");
  await writeIndex();
  log(`saved ${id} (${out.pages.length} chapters) → src/data/presets/${id}.json`);
}

async function writeIndex() {
  const files = (await readdir(PRESET_DIR)).filter((f) => f.endsWith(".json")).sort();
  const names = files.map((f, i) => [`p${i}`, f]);
  const src = `import type { Story } from "@/lib/schemas";
${names.map(([v, f]) => `import ${v} from "./${f}";`).join("\n")}

/** Built-in featured sagas (JSON in this folder, images in /public/presets). Regenerate with scripts/make-preset.mjs. */
export const PRESETS: Story[] = [${names.map(([v]) => `${v}`).join(", ")}] as Story[];
`;
  await writeFile(path.join(PRESET_DIR, "index.ts"), src);
}

if (cmd === "generate") await generate();
else if (cmd === "export") {
  const { story } = await api(`/api/stories/${positional[0]}`);
  await exportStory(story);
} else if (cmd === "index") await writeIndex();
else {
  console.log("Usage: node scripts/make-preset.mjs generate --surname Lim [--heritage teochew] [--name X] [--pronouns she] [--pages 2]");
  console.log("       node scripts/make-preset.mjs export <storyId>");
  process.exit(1);
}
