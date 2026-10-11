# Surname Saga 姓

**Culture × Tech: reinterpreting the past, present and future of culture through technology.**

Type your surname. An AI historian researches where it comes from and which dialect groups or lineages carried it around the world. You pick your heritage path, and the AI plans a whole saga: a central mystery, a recurring cast, and acts that span eras and continents. Then you star in an AI-drawn, interactive comic of your ancestors' journey. Every chapter has a "Did you know?" history note, a word in your ancestral language and a pop quiz. You choose what happens next.

## How it works

1. **Research** (`/api/research`): `gpt-6-astra` returns a structured "Origin File": the character or spelling, its meaning, its ancient origin, spellings across dialects and languages, a timeline, famous bearers, and 2–5 heritage paths ranked by likelihood. Results are cached per surname.
2. **Tips while you wait** (`/api/facts`): while the main model works, a fast model (`gpt-6-luna`) streams exactly 10 tips about the surname, and then about the chosen heritage. They show as one speech bubble at a time, with numbered buttons to click through them.
3. **Saga outline** (`/api/story/outline`): a "showrunner" prompt plans the title, heirloom, central mystery, recurring cast (with fixed visual descriptions) and 5–7 acts. The journey follows the real migration history of that heritage, anywhere in the world, and ends wherever the reader says home is today. The cover is painted in parallel.
4. **Writer AI — streaming chapters** (`/api/story/chapter`, `gpt-6-astra` on Ultrafast with medium reasoning): the writer only writes. It receives the previous chapters' scripts, including silent actions, settings, cast and dialogue, plus an explicit final-scene handoff and the reader's next choice. Chapters continue that scene, show the consequences of the choice, and bridge changes of place or time; an act can span several chapters. It produces a clear, kid-friendly script with a "Previously…" recap, the hero's outfit for the chapter, and 2–4 comic pages of 3–6 panels each (narration, short dialogue, what happens). Every new place and character is introduced in a caption. The JSON is parsed *while it streams*, and each finished comic page goes to the browser as an NDJSON event the moment it's written.
5. **Artist AI — art director + illustrator**: whole comic pages are drawn as **one picture each**, so the people and backgrounds stay identical from panel to panel.
   - The art director (`/api/sheet/direct`, `gpt-6-astra` on Ultrafast) plans the page: the panel layout, one fixed description of every location, who stands where, and which character each speech balloon points to. It plans ahead while the previous page is being painted.
   - The illustrator (`/api/sheet/draw`, `gpt-image-2.5-sunburst-2026-09-08`, 1536×2304 at medium quality) paints the page **with the captions and speech balloons lettered into the art**. Each page is drawn while looking at three reference images: the hero's cover (the face), the **cast model sheet** (everyone else, with names), and the previous page (style, outfits, locations). Pages are painted in order, one at a time, so each can look at the one before it.
   - A studio bar shows what each AI is doing. Any page can be tapped to enlarge, and a **Redraw this page** button under each finished page paints it again (handy if a word got misspelled in the lettering).
6. **Choose what's next**: three choices (bold, curious, heartfelt) or write your own. A journey map unlocks each act as you reach it.
7. **Share**: sagas are unlisted by default. "Share to gallery" adds yours to the community gallery, and other readers can **remix** a saga into their own copy and keep going.

## Stack

- **Next.js 16** (App Router, Cache Components) + **Tailwind v4** + **shadcn/ui**, restyled with a comic theme (Bangers + Comic Neue + Ma Shan Zheng brush font, halftone dots, ink borders, starbursts)
- **OpenAI**: `gpt-6-astra` on Ultrafast as the writer and art director (Responses API, structured outputs, streaming), `gpt-6-luna` for the tips, and `gpt-image-2.5-sunburst-2026-09-08` as the illustrator
- **Neon Postgres** (`@neondatabase/serverless`): stories, generated images and a research cache. The tables are created automatically on first use, and the built-in featured sagas are upserted as `is_featured` rows.

## Setup

```bash
npm install
cp .env.example .env.local   # add your OPENAI_API_KEY and DATABASE_URL
npm run dev
```

The text and art-director models default to `gpt-6-astra`; their Responses API requests use `service_tier: "ultrafast"`. Research and saga outlines share the text model and tier. Set `OPENAI_TEXT_MODEL` and `OPENAI_ART_MODEL` to `gpt-6-astra` in existing deployment environments as well. See the [OpenAI Ultrafast guide](https://developers.openai.com/api/docs/guides/ultrafast-mode).

`DATABASE_URL` is optional for local hacking. Without it, everything lives in server memory and resets when the server restarts. Set it for any real demo or deployment.

## Featured sagas

The featured sagas on the home page are stored in `src/data/presets/*.json`, with their images in `public/presets/`. To add more, run the dev server and use:

```bash
# generate a new one end to end
node scripts/make-preset.mjs generate --base http://localhost:3000 \
  --surname Goh --heritage hokkien --name "Jun Jie" --pronouns he --home Singapore --chapters 2

# or turn a saga you made in the app into a preset
node scripts/make-preset.mjs export <storyId> --base http://localhost:3000
```

## Project map

| Path | What |
| --- | --- |
| `src/lib/prompts.ts` | Historian, showrunner (outline), writer and art-director prompts; the illustrator's lettered-page brief and the cast sheet |
| `src/app/api/sheet/direct`, `draw` | The artist AI: the art director plans a page; the illustrator paints it with lettering |
| `src/lib/chapter-parser.ts` | Pulls finished comic pages out of the chapter JSON while it streams |
| `src/lib/layout.ts` | Comic page render sizes (portrait 1536×2304, landscape 2304×1536) |
| `src/lib/schemas.ts` | Zod schemas for AI output and the story data model |
| `src/lib/openai.ts` | Structured-output and image helpers (reference-image edits, with a fallback to plain generation) |
| `src/lib/db.ts` | Neon repository, plus an in-memory fallback |
| `src/components/saga-creator.tsx` | Surname → research → heritage → outline flow (with live fact feeds) |
| `src/components/story-reader.tsx` | Comic reader: streamed chapters, the page planning/painting queue, journey map, share and remix |
| `src/components/comic/comic-sheet.tsx` | One comic page: the image (tap to enlarge), or its script while it's being drawn |
| `src/components/comic/loading-comic.tsx` | The 10-tip deck shown while the AI works |
| `src/components/comic/*` | Panels, speech bubbles, quiz, Origin File, gallery cards |

## Notes

- Stories are AI-generated for learning and fun. Each Origin File includes an honest caveat, and the footer suggests checking family history with relatives, heritage associations and local archives.
- Generation routes have a simple per-IP rate limit (`src/lib/rate-limit.ts`) so a public demo can't run through the API budget.
- Ownership is a per-browser secret token (hashed in the DB). Only the browser that created a saga can continue or share it.
