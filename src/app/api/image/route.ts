import { nanoid } from "nanoid";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { repo } from "@/lib/db";
import { generateImage } from "@/lib/openai";
import { castSheetPrompt, coverPrompt } from "@/lib/prompts";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { CastMemberSchema, HeritageOptionSchema, HeroInputSchema, ResearchSchema } from "@/lib/schemas";

export const maxDuration = 180;

const Body = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("cover"),
    storyId: z.string().max(40),
    hero: HeroInputSchema,
    heritage: HeritageOptionSchema,
    research: ResearchSchema,
  }),
  z.object({
    kind: z.literal("cast"),
    storyId: z.string().max(40),
    homeland: z.string().max(300),
    cast: z.array(CastMemberSchema).min(1).max(8),
  }),
]);

/** Paints a saga's cover (the hero's face reference) or its cast model sheet. Story pages go through /api/sheet. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad image request." }, { status: 400 });
  if (!rateLimit(req, "image", 400, 10 * 60_000)) return tooMany();

  const b = parsed.data;
  try {
    const image =
      b.kind === "cover"
        ? await generateImage({ prompt: coverPrompt(b.hero, b.heritage, b.research), size: "1024x1536" })
        : await generateImage({ prompt: castSheetPrompt({ cast: b.cast, homeland: b.homeland }), size: "1536x1024" });
    const id = nanoid(16);
    await repo().saveImage(id, b.storyId, image.mime, image.data);
    return Response.json({ url: `/api/images/${id}` });
  } catch (err) {
    return errorResponse(err);
  }
}
