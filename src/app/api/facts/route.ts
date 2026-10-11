import { z } from "zod";
import { streamFastText } from "@/lib/openai";
import { FACTS_SYSTEM, factsPrompt } from "@/lib/prompts";
import { rateLimit, tooMany } from "@/lib/rate-limit";

export const maxDuration = 60;

const Body = z.object({
  surname: z.string().trim().min(1).max(40),
  heritage: z.object({ name: z.string().max(80), homeland: z.string().max(200) }).nullable().optional(),
  avoid: z.array(z.string().max(300)).max(30).optional(),
});

/** Streams one fun fact per line from the fast model while the main model works. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  if (!rateLimit(req, "facts", 200, 10 * 60_000)) return tooMany();

  const stream = streamFastText({ system: FACTS_SYSTEM, prompt: factsPrompt(parsed.data), signal: req.signal });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
