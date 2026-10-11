import type { Metadata } from "next";
import { Bangers, Comic_Neue } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const bangers = Bangers({
  variable: "--font-bangers",
  weight: "400",
  subsets: ["latin"],
});

const comicNeue = Comic_Neue({
  variable: "--font-comic-neue",
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Surname Saga — Star in your ancestors' story",
  description:
    "Type your surname. Discover its history and dialect roots. Then star in an AI-drawn comic of your ancestors' journey across the world.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bangers.variable} ${comicNeue.variable} h-full antialiased`}>
      <head>
        {/* Brush-style Chinese glyphs for surname characters (loaded per unicode-range on demand). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- root layout applies to every page */}
        <link href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&display=swap" rel="stylesheet" />
      </head>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="border-t-[3px] border-ink bg-ink px-4 py-6 text-center text-sm text-paper">
            <p className="font-display text-xl tracking-wider text-pow">Surname Saga</p>
            <p className="mt-1 opacity-80">
              Culture × Tech — stories are AI-generated for learning and fun. Verify family history with relatives,
              clan or heritage associations, and local archives.
            </p>
          </footer>
        </TooltipProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
