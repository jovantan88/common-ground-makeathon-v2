import { repo } from "@/lib/db";

export async function GET(_req: Request, ctx: RouteContext<"/api/images/[id]">) {
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return new Response("Not found", { status: 404 });
  const image = await repo().getImage(id);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
