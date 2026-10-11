import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { StoryReader } from "@/components/story-reader";
import { repo } from "@/lib/db";

export async function generateMetadata(props: PageProps<"/story/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  await connection();
  const found = await repo().getStory(id).catch(() => null);
  if (!found) return { title: "Saga not found — Surname Saga" };
  return { title: `${found.story.title} — Surname Saga`, description: found.story.tagline };
}

export default async function StoryPage(props: PageProps<"/story/[id]">) {
  const { id } = await props.params;
  await connection();
  const found = await repo().getStory(id);
  if (!found) notFound();
  return <StoryReader key={found.story.id} initial={found.story} />;
}
