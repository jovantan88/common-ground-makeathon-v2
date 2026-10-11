import "server-only";

/**
 * Tiny in-memory sliding-window limiter so a public demo can't burn through the
 * OpenAI budget. Per server instance only — good enough for a hackathon.
 */
const hits = new Map<string, number[]>();

export function rateLimit(req: Request, bucket: string, max: number, windowMs: number) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function tooMany() {
  return Response.json(
    { error: "Whoa, slow down, hero! Too many requests — try again in a few minutes." },
    { status: 429 }
  );
}
