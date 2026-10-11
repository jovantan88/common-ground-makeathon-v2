import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border-[3px] border-ink bg-white px-3 py-1 text-base font-bold shadow-comic-sm transition-all outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-base",
        className
      )}
      {...props}
    />
  )
}

export { Input }
