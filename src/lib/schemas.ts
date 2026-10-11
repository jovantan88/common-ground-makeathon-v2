import { z } from "zod";

/* ------------------------------------------------------------------ */
/* AI output schemas (used for OpenAI structured outputs)              */
/* ------------------------------------------------------------------ */

export const HeritageOptionSchema = z.object({
  id: z.string().describe("short kebab-case id, e.g. 'hokkien'"),
  name: z.string().describe("Dialect group / heritage name in English, e.g. 'Hokkien', 'Ulster Irish'"),
  nativeName: z
    .string()
    .describe("Name in native script, e.g. '福建' — empty string if not applicable"),
  spelling: z.string().describe("How the surname is spelled/romanised in this group, e.g. 'Tan'"),
  homeland: z.string().describe("Ancestral region, e.g. 'Southern Fujian — Quanzhou, Zhangzhou, Xiamen'"),
  migrationStory: z
    .string()
    .describe("1–2 sentences on where this group's people journeyed in history, when and why"),
  likelihood: z.enum(["high", "medium", "low"]),
  funFact: z.string().describe("One short, true, delightful fact about this group"),
});

export const ResearchSchema = z.object({
  surname: z.string().describe("Surname in the user's spelling, properly capitalised"),
  nativeScript: z
    .string()
    .describe("Surname in native script, e.g. '陈 (陳)'. Empty string if not applicable"),
  culture: z.string().describe("e.g. 'Chinese', 'Irish', 'Korean', 'Tamil', 'Portuguese-Eurasian'"),
  meaning: z.string().describe("What the surname/character means, 1–2 sentences"),
  summary: z.string().describe("2–3 sentence overview of the surname's history"),
  originStory: z.string().describe("The ancient origin story of the surname, 2–4 sentences"),
  romanizations: z
    .array(z.object({ label: z.string(), spelling: z.string() }))
    .describe("How the name is spelled across dialects/languages, e.g. {label:'Mandarin', spelling:'Chén'}"),
  timeline: z
    .array(z.object({ era: z.string(), event: z.string() }))
    .describe("4–6 key moments from origin to today, including major migrations"),
  heritageOptions: z.array(HeritageOptionSchema).describe("2–5 options, most likely first"),
  famousBearers: z.array(z.object({ name: z.string(), note: z.string() })).describe("2–4 notable people"),
  funFacts: z.array(z.string()).describe("4–6 short fun facts, each one sentence"),
  caveat: z.string().describe("Honest note on uncertainty, e.g. one spelling maps to several characters"),
});

export const CastMemberSchema = z.object({
  name: z.string(),
  role: z.string().describe("Relation to the hero or role, e.g. 'great-great-grandfather', 'junk captain', 'rival'"),
  look: z
    .string()
    .describe("Consistent visual description for the illustrator: age, build, face, hair, signature clothing"),
});

export const OutlineSchema = z.object({
  title: z.string().describe("Evocative comic title, ≤ 6 words. Don't start with the surname and a colon."),
  tagline: z.string().describe("One-line teaser, ≤ 15 words"),
  logline: z.string().describe("Two-sentence pitch of the whole saga"),
  heirloom: z.object({
    name: z.string(),
    description: z.string().describe("What it looks like and why it pulls the hero through time"),
  }),
  mystery: z.string().describe("The central question that drives the saga and is answered in the finale"),
  cast: z.array(CastMemberSchema).describe("3–6 recurring characters, not including the hero"),
  acts: z
    .array(
      z.object({
        title: z.string(),
        place: z.string(),
        era: z.string(),
        beat: z.string().describe("What happens, the obstacle, and the dramatic turn — 2 sentences"),
        history: z.string().describe("The real history this act teaches — 1 sentence"),
      })
    )
    .describe("5–7 acts: present-day discovery → the past, in chronological order → return to the present"),
});

export const SHEET_FORMATS = ["portrait", "landscape"] as const;
export type SheetFormat = (typeof SHEET_FORMATS)[number];

export const PanelSchema = z.object({
  setting: z.string().describe("Place and year shown in this panel, e.g. 'Quanzhou harbour, 1853'"),
  cast: z.array(z.string()).describe("Names of recurring cast members visible in this panel (not the hero)"),
  scene: z
    .string()
    .describe("What happens in this panel and what we see, in 1–3 plain sentences. Call the protagonist 'the hero'."),
  shot: z.enum(["wide", "medium", "close-up"]),
  caption: z
    .string()
    .nullable()
    .describe("Narration box, ≤ 14 words, plain common English — it will be hand-lettered into the art"),
  dialogue: z
    .array(
      z.object({
        speaker: z.string().describe("Exact character name, or the hero's first name"),
        text: z.string().describe("≤ 10 words, plain common words — it will be hand-lettered into a speech balloon"),
      })
    )
    .describe("0–2 speech balloons, in reading order"),
  sfx: z.string().nullable().describe("Optional short sound effect like 'WHOOSH!' or null"),
});

/** One comic page: a single illustration holding several panels (drawn in one go so everything stays consistent). */
export const SheetSchema = z.object({
  format: z
    .enum(SHEET_FORMATS)
    .describe("portrait for 4–6 panels; landscape (wide page) for 2–3 big cinematic panels"),
  panels: z.array(PanelSchema).describe("3–6 panels in reading order (2–3 on a landscape page)"),
});

/** The art director's plan for one comic page (second AI). */
export const ArtDirectionSchema = z.object({
  layout: z
    .string()
    .describe(
      "How the panels are arranged on the page, row by row, e.g. 'Row 1: panel 1, full width. Row 2: panels 2 and 3 side by side. Row 3: panel 4, full width.'"
    ),
  locations: z
    .string()
    .describe(
      "One fixed description of every location on this page (architecture, props, weather, light, colours) so the background stays identical wherever it reappears"
    ),
  panels: z
    .array(
      z.object({
        position: z.string().describe("Where this panel sits in the layout, e.g. 'row 2, left half'"),
        composition: z.string().describe("Camera angle, framing and mood in 1–2 sentences"),
        characters: z
          .array(
            z.object({
              name: z.string(),
              position: z.string().describe("Where they stand in the panel, e.g. 'left foreground'"),
              action: z.string().describe("Pose, gesture and facial expression"),
            })
          )
          .describe("Everyone important in the panel, placed so each speaker's balloon can point straight at them"),
        balloons: z
          .array(
            z.object({
              line: z.number().int().describe("0-based index of this panel's dialogue line"),
              placement: z.string().describe("Where the balloon sits in the panel, e.g. 'top-left'"),
              pointsTo: z.string().describe("Name of the speaker the tail points at"),
            })
          )
          .describe("One entry per dialogue line, in reading order"),
        captionPlacement: z
          .string()
          .describe("Where the caption box sits in the panel, e.g. 'top-left corner'; empty if no caption"),
      })
    )
    .describe("One entry per panel, in the same order as the script"),
});

// Key order matters: comic pages stream before the end-of-chapter extras.
export const ChapterSchema = z.object({
  chapterTitle: z
    .string()
    .describe("Short chapter name only, ≤ 6 words — never include the comic title or a chapter number"),
  place: z.string().describe("Main place of this chapter, e.g. 'Quanzhou, Fujian'"),
  year: z.string().describe("e.g. '1868' or 'Present day'"),
  act: z.number().int().describe("1-based index of the outline act this chapter belongs to"),
  recap: z
    .string()
    .describe("'Previously…' recap in 1–2 simple sentences (for chapter 1: who the hero is and what they want)"),
  heroOutfit: z
    .string()
    .describe("Exactly what the hero wears this chapter (colours, garments); if it changes mid-chapter, say when"),
  sheets: z
    .array(SheetSchema)
    .describe("The chapter's comic pages in reading order — usually 2 to 4, each one a self-contained beat"),
  historyNote: z
    .object({ title: z.string(), body: z.string().describe("2–4 sentences of verifiable history") })
    .describe("The educational 'Did you know?' box for this chapter"),
  dialectWord: z
    .object({
      language: z.string().describe("e.g. 'Hokkien', 'Irish', 'Kristang'"),
      term: z.string().describe("Romanised word/phrase"),
      script: z.string().describe("Native script, or empty string"),
      meaning: z.string(),
    })
    .nullable()
    .describe("A real word in the heritage dialect/language used in this chapter, or null if unsure"),
  quiz: z.object({
    question: z.string(),
    options: z.array(z.string()).describe("Exactly 3 options"),
    answerIndex: z.number().int().describe("0-based index of the correct option"),
    explanation: z.string(),
  }),
  choices: z.array(z.string()).describe("Exactly 3 suggested next actions, ≤ 14 words each"),
  isFinale: z.boolean(),
});

export type HeritageOption = z.infer<typeof HeritageOptionSchema>;
export type Research = z.infer<typeof ResearchSchema>;
export type Outline = z.infer<typeof OutlineSchema>;
export type AIPanel = z.infer<typeof PanelSchema>;
export type AISheet = z.infer<typeof SheetSchema>;
export type ArtDirection = z.infer<typeof ArtDirectionSchema>;
export type AIChapter = z.infer<typeof ChapterSchema>;

/* ------------------------------------------------------------------ */
/* App data model                                                      */
/* ------------------------------------------------------------------ */

export const PRONOUNS = ["he", "she", "they"] as const;
export type Pronouns = (typeof PRONOUNS)[number];

export type Hero = {
  name: string;
  surname: string;
  pronouns: Pronouns;
  look: string;
  /** Where the hero lives today — anchors the present-day scenes. */
  home: string;
};

export type Panel = AIPanel;

export type Sheet = AISheet & {
  id: string;
  /** The finished comic-page illustration, lettering included. */
  imageUrl: string | null;
  /** The art director's plan, kept so a failed render can be retried without re-planning. */
  art: ArtDirection | null;
};

export type Page = Omit<AIChapter, "sheets"> & {
  id: string;
  sheets: Sheet[];
  /** The reader prompt that produced this chapter (null for chapter 1). */
  prompt: string | null;
  /** Client-only: the chapter is still being written. Never persisted. */
  streaming?: boolean;
};

export type Story = {
  id: string;
  version: 1;
  hero: Hero;
  heritage: HeritageOption;
  research: Research;
  outline: Outline | null;
  title: string;
  tagline: string;
  coverUrl: string | null;
  /** Model sheet of the recurring cast, used as an art reference so everyone stays on-model. */
  castUrl: string | null;
  pages: Page[];
  isPublic: boolean;
  isFeatured?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StorySummary = {
  id: string;
  title: string;
  tagline: string;
  surname: string;
  heroName: string;
  heritageName: string;
  nativeScript: string;
  coverUrl: string | null;
  pageCount: number;
  isFeatured: boolean;
  createdAt: string;
};

/**
 * Stories saved before comic pages existed have no `sheets`/`castUrl`. Fill the gaps so
 * they still open (their text shows; the old per-panel art is not carried over).
 */
export function normalizeStory(story: Story): Story {
  return {
    ...story,
    castUrl: story.castUrl ?? null,
    outline: story.outline ?? null,
    pages: story.pages.map((p) => ({ ...p, sheets: p.sheets ?? [] })),
  };
}

export function heroDisplayName(hero: Pick<Hero, "name" | "surname">) {
  return hero.name ? `${hero.name} ${hero.surname}` : `Ah ${hero.surname}`;
}

export function summarize(story: Story): StorySummary {
  return {
    id: story.id,
    title: story.title,
    tagline: story.tagline,
    surname: story.hero.surname,
    heroName: story.hero.name,
    heritageName: story.heritage.name,
    nativeScript: story.research.nativeScript,
    coverUrl: story.coverUrl,
    pageCount: story.pages.length,
    isFeatured: !!story.isFeatured,
    createdAt: story.createdAt,
  };
}

/* ------------------------------------------------------------------ */
/* Request validation                                                  */
/* ------------------------------------------------------------------ */

export const HeroInputSchema = z.object({
  name: z.string().trim().max(40),
  surname: z.string().trim().min(1).max(40),
  pronouns: z.enum(PRONOUNS),
  look: z.string().trim().max(200),
  home: z.string().trim().max(80).default(""),
});

/** Only images we host ourselves may be referenced from a stored story. */
const ImageUrl = z
  .string()
  .max(300)
  .regex(/^\/(api\/images|presets)\/[A-Za-z0-9_.-]+$/);

/** Runtime validation for stories posted by clients (tolerates older saved shapes). */
export const StoryInputSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{6,40}$/),
    version: z.literal(1),
    hero: HeroInputSchema,
    heritage: HeritageOptionSchema,
    research: ResearchSchema,
    outline: OutlineSchema.nullable().default(null),
    title: z.string().max(200),
    tagline: z.string().max(400),
    coverUrl: ImageUrl.nullable(),
    castUrl: ImageUrl.nullable().default(null),
    pages: z
      .array(
        ChapterSchema.extend({
          id: z.string(),
          prompt: z.string().max(600).nullable(),
          act: z.number().int().default(1),
          recap: z.string().max(600).default(""),
          heroOutfit: z.string().max(600).default(""),
          dialectWord: ChapterSchema.shape.dialectWord.unwrap().partial({ language: true }).nullable(),
          sheets: z.array(
            SheetSchema.extend({
              id: z.string(),
              imageUrl: ImageUrl.nullable(),
              art: ArtDirectionSchema.nullable().default(null),
            })
          ),
        })
      )
      .max(100),
    isPublic: z.boolean(),
    isFeatured: z.boolean().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();
