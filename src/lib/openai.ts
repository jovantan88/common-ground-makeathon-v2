import "server-only";
import OpenAI, { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-6-astra";
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-sunburst-2026-09-08";
/** Quick, cheap model for side-quests like streaming fun facts while the main model works. */
export const FAST_MODEL = process.env.OPENAI_FAST_MODEL || "gpt-6-luna";
// A little reasoning keeps facts accurate (first fact in ~6s instead of ~2s — still well inside the wait).
const FAST_EFFORT = (process.env.OPENAI_FAST_EFFORT || "low") as Effort;
/** The second AI: an art director that plans every comic page (layout, staging, balloons) for the illustrator. */
export const ART_MODEL = process.env.OPENAI_ART_MODEL || "gpt-6-astra";
export const ART_EFFORT = (process.env.OPENAI_ART_EFFORT || "low") as Effort;
// Medium lettered whole comic pages just as cleanly as low at the same speed, with sharper art.
const IMAGE_QUALITY = (process.env.OPENAI_IMAGE_QUALITY || "medium") as "low" | "medium" | "high";

let client: OpenAI | null = null;

export function openai() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Add it to .env.local.");
  }
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

type Effort = "none" | "low" | "medium" | "high";

/** Ask the text model for JSON that matches a zod schema. */
export async function generateObject<S extends z.ZodType>(opts: {
  schema: S;
  name: string;
  system: string;
  prompt: string;
  effort?: Effort;
  model?: string;
  signal?: AbortSignal;
}): Promise<z.infer<S>> {
  const response = await openai().responses.parse(
    {
      model: opts.model ?? TEXT_MODEL,
      service_tier: "ultrafast",
      reasoning: { effort: opts.effort ?? "low" },
      instructions: opts.system,
      input: opts.prompt,
      text: { format: zodTextFormat(opts.schema, opts.name) },
    },
    { signal: opts.signal }
  );
  if (!response.output_parsed) {
    throw new Error("The storyteller returned an empty response. Please try again.");
  }
  return response.output_parsed as z.infer<S>;
}

/**
 * Stream a structured response. `onDelta` receives raw JSON text as it is
 * written (for incremental parsing); resolves with the validated object.
 */
export async function streamObject<S extends z.ZodType>(opts: {
  schema: S;
  name: string;
  system: string;
  prompt: string;
  effort?: Effort;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}): Promise<z.infer<S>> {
  const stream = openai().responses.stream(
    {
      model: TEXT_MODEL,
      service_tier: "ultrafast",
      reasoning: { effort: opts.effort ?? "low" },
      instructions: opts.system,
      input: opts.prompt,
      text: { format: zodTextFormat(opts.schema, opts.name) },
    },
    { signal: opts.signal }
  );
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") opts.onDelta(event.delta);
  }
  const final = await stream.finalResponse();
  if (!final.output_parsed) throw new Error("The storyteller returned an empty response. Please try again.");
  return final.output_parsed as z.infer<S>;
}

/** Stream plain text from the fast model as a web ReadableStream of UTF-8 bytes. */
export function streamFastText(opts: { system: string; prompt: string; signal?: AbortSignal }) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = await openai().responses.create(
          {
            model: FAST_MODEL,
            reasoning: { effort: FAST_EFFORT },
            instructions: opts.system,
            input: opts.prompt,
            stream: true,
          },
          { signal: opts.signal }
        );
        for await (const event of stream) {
          if (event.type === "response.output_text.delta") controller.enqueue(encoder.encode(event.delta));
        }
      } catch (err) {
        if (!opts.signal?.aborted) console.warn("[fast-text]", (err as Error).message);
      } finally {
        controller.close();
      }
    },
  });
}

export type ImageSize = "1024x1536" | "1536x1024" | "1536x2304" | "2304x1536";

/**
 * Generate an image, optionally anchored to reference images (the hero's cover,
 * the cast model sheet, the previous comic page) so everyone stays on-model.
 * References are passed in order. Returns raw bytes + mime type.
 */
export async function generateImage(opts: {
  prompt: string;
  size: ImageSize;
  references?: { data: Buffer; mime: string }[];
}): Promise<{ data: Buffer; mime: string }> {
  const common = {
    model: IMAGE_MODEL,
    prompt: opts.prompt,
    size: opts.size,
    quality: IMAGE_QUALITY,
    output_format: "webp" as const,
    output_compression: 80,
  };

  let b64: string | undefined;
  if (opts.references?.length) {
    try {
      const files = await Promise.all(
        opts.references.map((r, i) =>
          toFile(r.data, `reference-${i + 1}.${r.mime.split("/")[1] ?? "webp"}`, { type: r.mime })
        )
      );
      const res = await openai().images.edit({ ...common, image: files });
      b64 = res.data?.[0]?.b64_json;
    } catch (err) {
      // Fall back to a plain generation so a flaky reference never blocks the comic.
      console.warn("[image] reference edit failed, falling back to generate:", (err as Error).message);
    }
  }
  if (!b64) {
    const res = await openai().images.generate({ ...common, moderation: "low" });
    b64 = res.data?.[0]?.b64_json;
  }
  if (!b64) throw new Error("The illustrator came back empty-handed. Please retry.");
  return { data: Buffer.from(b64, "base64"), mime: "image/webp" };
}
