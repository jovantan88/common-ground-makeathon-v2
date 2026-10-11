import "server-only";
import { repo } from "./db";

type Ref = { data: Buffer; mime: string };

/** Load an image we host (a generated image or a preset file) as raw bytes. */
async function loadReference(url: string | null, req: Request): Promise<Ref | null> {
  if (!url) return null;
  const m = url.match(/^\/api\/images\/([A-Za-z0-9_-]+)$/);
  if (m) return repo().getImage(m[1]);
  if (/^\/presets\/[A-Za-z0-9_.-]+$/.test(url)) {
    const res = await fetch(new URL(url, req.url));
    if (!res.ok) return null;
    return { data: Buffer.from(await res.arrayBuffer()), mime: res.headers.get("content-type") || "image/webp" };
  }
  return null;
}

/**
 * Load several optional references in order. `images` holds the ones that were
 * found (in order); `found[i]` says whether the i-th requested slot was filled,
 * so the prompt only describes references that are really attached.
 */
export async function loadReferences(urls: (string | null)[], req: Request) {
  const loaded = await Promise.all(urls.map((u) => loadReference(u, req).catch(() => null)));
  return { images: loaded.filter((r): r is Ref => !!r), found: loaded.map((r) => !!r) };
}
