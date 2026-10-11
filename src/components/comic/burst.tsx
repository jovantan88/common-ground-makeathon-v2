import { cn } from "@/lib/utils";

/** A pop-art starburst badge ("POW!") with an ink outline. */
export function Burst({
  children,
  className,
  color = "bg-pow",
  textClassName,
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("relative inline-grid place-items-center", className)}>
      <span aria-hidden className="burst absolute inset-0 bg-ink" />
      <span aria-hidden className={cn("burst absolute inset-[5px]", color)} />
      <span className={cn("comic-title relative px-3 text-center", textClassName)}>{children}</span>
    </span>
  );
}
