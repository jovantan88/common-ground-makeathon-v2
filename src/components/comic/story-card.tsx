import Link from "next/link";
import type { StorySummary } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const TILTS = ["-rotate-1", "rotate-1", "-rotate-2", "rotate-2", "rotate-0"];

export function StoryCard({ story, index = 0 }: { story: StorySummary; index?: number }) {
  const hanzi = story.nativeScript.split(/[\s(（]/)[0];
  return (
    <Link
      href={`/story/${story.id}`}
      className={cn(
        "group comic-box block bg-white transition-all hover:z-10 hover:-translate-y-1 hover:rotate-0 hover:shadow-comic-lg",
        TILTS[index % TILTS.length]
      )}
    >
      <div className="relative aspect-[2/3] overflow-hidden border-b-[3px] border-ink bg-paper">
        {story.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.coverUrl}
            alt={`Cover of ${story.title}`}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="sunburst size-full" />
        )}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-ink/80 to-transparent p-3 pb-10">
          <p className="comic-title text-3xl leading-[0.9] text-pow text-outline-sm">{story.title}</p>
        </div>
        <span className="burst absolute right-2 bottom-2 grid size-16 place-items-center bg-zap text-white">
          <span className={cn(hanzi ? "font-brush text-3xl" : "comic-title text-lg")}>{hanzi || story.surname}</span>
        </span>
        {story.isFeatured && (
          <span className="absolute bottom-2 left-2 border-2 border-ink bg-pow px-1.5 py-0.5 text-[10px] font-bold uppercase">
            Featured
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-3">
        <p className="line-clamp-2 text-sm leading-snug">{story.tagline}</p>
        <p className="text-xs font-bold text-muted-foreground uppercase">
          {story.heroName ? `${story.heroName} ${story.surname}` : story.surname} · {story.heritageName} ·{" "}
          {story.pageCount} {story.pageCount === 1 ? "page" : "pages"}
        </p>
      </div>
    </Link>
  );
}
