export default function Loading() {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-[minmax(0,360px)_1fr]">
      <div className="comic-box pencil-sketch animate-ink aspect-[2/3]" />
      <div className="space-y-4">
        <p className="comic-title text-5xl">Opening the saga…</p>
        <div className="comic-box pencil-sketch animate-ink h-40" />
      </div>
    </div>
  );
}
