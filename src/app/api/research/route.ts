import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { repo } from "@/lib/db";
import { generateObject } from "@/lib/openai";
import { RESEARCH_SYSTEM } from "@/lib/prompts";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { ResearchSchema } from "@/lib/schemas";

export const maxDuration = 90;

const Body = z.object({ surname: z.string().trim().min(1).max(40) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please enter a surname." }, { status: 400 });

  const surname = parsed.data.surname.replace(/\s+/g, " ");
  const key = surname.toLowerCase();

  try {
    const cached = await repo().getResearch(key).catch(() => null);
    if (cached) return Response.json({ research: cached, cached: true });

    if (!rateLimit(req, "research", 60, 10 * 60_000)) return tooMany();

    const research = await generateObject({
      schema: ResearchSchema,
      name: "surname_research",
      system: RESEARCH_SYSTEM,
      prompt: `Surname: "${surname}"`,
      effort: "low",
    });
    research.heritageOptions = research.heritageOptions.slice(0, 5);
    await repo().saveResearch(key, research).catch((e) => console.warn("[research] cache write failed", e));
    return Response.json({ research });
  } catch (err) {
    return errorResponse(err);
  }
}
