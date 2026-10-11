import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-ink bg-pow">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="group flex items-center gap-2">
          <span className="burst grid size-11 place-items-center bg-zap font-brush text-2xl text-white transition-transform group-hover:rotate-12">
            姓
          </span>
          <span className="comic-title text-3xl text-white text-outline-sm sm:text-4xl">Surname Saga</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/#gallery">Gallery</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/create">New Saga!</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
