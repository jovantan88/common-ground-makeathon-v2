import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { ART_EFFORT, ART_MODEL, generateObject } from "@/lib/openai";
import { ART_DIRECTOR_SYSTEM, artPrompt, heroLook } from "@/lib/prompts";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { ArtDirectionSchema, HeritageOptionSchema, HeroInputSchema, heroDisplayName, SheetSchema } from "@/lib/schemas";

export const maxDuration = 120;

const Body = z.object({
  hero: HeroInputSchema,
  heritage: HeritageOptionSchema,
  culture: z.string().max(120),
  heroOutfit: z.string().max(600).default(""),
  castBible: z.array(z.string().max(500)).max(8),
  previous: z.array(z.string().max(600)).max(8),
  sheet: SheetSchema,
});

/** The art director (second AI) plans a whole comic page: layout, locations, staging and balloon placement. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad page request." }, { status: 400 });
  if (!rateLimit(req, "direct", 400, 10 * 60_000)) return tooMany();

  const b = parsed.data;
  try {
    const art = await generateObject({
      schema: ArtDirectionSchema,
      name: "page_art_direction",
      model: ART_MODEL,
      effort: ART_EFFORT,
      system: ART_DIRECTOR_SYSTEM,
      signal: req.signal,
      prompt: artPrompt({
        format: b.sheet.format,
        heroName: b.hero.name || heroDisplayName(b.hero),
        heroDescription: heroLook(b.hero, b.heritage, { culture: b.culture }),
        heroOutfit: b.heroOutfit,
        castBible: b.castBible,
        panels: b.sheet.panels,
        previous: b.previous,
      }),
    });
    return Response.json({ art });
  } catch (err) {
    return errorResponse(err);
  }
}
