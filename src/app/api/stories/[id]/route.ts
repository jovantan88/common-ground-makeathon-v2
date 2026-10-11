import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { repo } from "@/lib/db";
import { StoryInputSchema, type Story } from "@/lib/schemas";

export async function GET(_req: Request, ctx: RouteContext<"/api/stories/[id]">) {
  const { id } = await ctx.params;
  const found = await repo().getStory(id);
  if (!found) return Response.json({ error: "Story not found" }, { status: 404 });
  return Response.json({ story: found.story });
}

const Body = z.object({
  story: StoryInputSchema,
  ownerToken: z.string().min(16).max(80),
});

export async function PUT(req: Request, ctx: RouteContext<"/api/stories/[id]">) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.story.id !== id) {
    return Response.json({ error: "Invalid story payload." }, { status: 400 });
  }
  try {
    const story = { ...parsed.data.story, updatedAt: new Date().toISOString() } as Story;
    const ok = await repo().saveStory(story, parsed.data.ownerToken);
    if (!ok) return Response.json({ error: "This saga belongs to someone else." }, { status: 403 });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
