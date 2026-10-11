import { z } from "zod";
import { createChapterParser } from "@/lib/chapter-parser";
import { streamObject } from "@/lib/openai";
import { chapterPrompt, chapterSystem } from "@/lib/prompts";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { ChapterSchema, StoryInputSchema, type Story } from "@/lib/schemas";

export const maxDuration = 300;

const Body = z.object({
  story: StoryInputSchema,
  prompt: z.string().trim().min(1).max(500).nullable(),
});

/**
 * Writes the next chapter and streams it as NDJSON:
 *   {type:"meta"} → {type:"sheet"} × N (as each page is written) → {type:"chapter"} | {type:"error"}
 * so the reader can start drawing pages long before the chapter is finished.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Tell the story what happens next!" }, { status: 400 });
  if (parsed.data.story.pages.length > 0 && !parsed.data.prompt) {
    return Response.json({ error: "Tell the story what happens next!" }, { status: 400 });
  }
  if (!rateLimit(req, "story", 150, 10 * 60_000)) return tooMany();

  const story = parsed.data.story as unknown as Story;
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const parse = createChapterParser();
      try {
        const chapter = await streamObject({
          schema: ChapterSchema,
          name: "comic_chapter",
          system: chapterSystem(story),
          prompt: chapterPrompt(story, parsed.data.prompt),
          effort: "medium",
          signal: req.signal,
          onDelta: (text) => parse(text).forEach(send),
        });
        send({ type: "chapter", chapter });
      } catch (err) {
        if (!req.signal.aborted) {
          console.error("[chapter]", err);
          send({ type: "error", message: err instanceof Error ? err.message : "The storyteller lost the thread." });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
