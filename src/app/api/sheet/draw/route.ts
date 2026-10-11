import { nanoid } from "nanoid";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { repo } from "@/lib/db";
import { SHEET_SIZE } from "@/lib/layout";
import { generateImage } from "@/lib/openai";
import { heroLook, letteredSheetPrompt } from "@/lib/prompts";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { loadReferences } from "@/lib/image-refs";
import {
  ArtDirectionSchema,
  HeritageOptionSchema,
  HeroInputSchema,
  heroDisplayName,
  SheetSchema,
} from "@/lib/schemas";

export const maxDuration = 240;

const RefUrl = z.string().max(300).nullable();

const Body = z.object({
  storyId: z.string().max(40),
  hero: HeroInputSchema,
  heritage: HeritageOptionSchema,
  culture: z.string().max(120),
  heroOutfit: z.string().max(600).default(""),
  cast: z.array(z.object({ name: z.string().max(80), role: z.string().max(200), look: z.string().max(500) })).max(8),
  sheet: SheetSchema,
  art: ArtDirectionSchema,
  refs: z.object({ cover: RefUrl, cast: RefUrl, previous: RefUrl }),
});

/** The illustrator paints one whole comic page — every panel, balloon and caption — in a single image. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad page request." }, { status: 400 });
  if (!rateLimit(req, "image", 400, 10 * 60_000)) return tooMany();

  const b = parsed.data;
  try {
    const refs = await loadReferences([b.refs.cover, b.refs.cast, b.refs.previous], req);
    const image = await generateImage({
      size: SHEET_SIZE[b.sheet.format],
      references: refs.images,
      prompt: letteredSheetPrompt({
        format: b.sheet.format,
        heroName: b.hero.name || heroDisplayName(b.hero),
        heroDescription: heroLook(b.hero, b.heritage, { culture: b.culture }),
        heroOutfit: b.heroOutfit,
        cast: b.cast,
        panels: b.sheet.panels,
        art: b.art,
        refs: { cover: refs.found[0], cast: refs.found[1], previous: refs.found[2] },
      }),
    });
    const id = nanoid(16);
    await repo().saveImage(id, b.storyId, image.mime, image.data);
    return Response.json({ url: `/api/images/${id}` });
  } catch (err) {
    return errorResponse(err);
  }
}
