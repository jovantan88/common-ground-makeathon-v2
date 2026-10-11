import { connection } from "next/server";
import { errorResponse } from "@/lib/api";
import { repo } from "@/lib/db";

export async function GET() {
  await connection(); // live gallery data — never prerender
  try {
    return Response.json({ stories: await repo().listStories(48) });
  } catch (err) {
    return errorResponse(err);
  }
}
