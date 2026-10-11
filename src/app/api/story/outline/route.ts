import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { generateObject } from "@/lib/openai";
import { OUTLINE_SYSTEM, outlinePrompt } from "@/lib/prompts";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { HeritageOptionSchema, HeroInputSchema, OutlineSchema, ResearchSchema } from "@/lib/schemas";

export const maxDuration = 120;

const Body = z.object({ hero: HeroInputSchema, heritage: HeritageOptionSchema, research: ResearchSchema });

/** Plans the whole saga — title, mystery, cast and acts — before any page is drawn. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Missing hero details." }, { status: 400 });
  if (!rateLimit(req, "story", 150, 10 * 60_000)) return tooMany();

  const { hero, heritage, research } = parsed.data;
  try {
    const outline = await generateObject({
      schema: OutlineSchema,
      name: "saga_outline",
      system: OUTLINE_SYSTEM,
      prompt: outlinePrompt(hero, heritage, research),
      effort: "low",
    });
    return Response.json({ outline });
  } catch (err) {
    return errorResponse(err);
  }
}
