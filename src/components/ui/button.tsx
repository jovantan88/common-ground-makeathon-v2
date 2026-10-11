import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border-[3px] border-ink font-display tracking-wide uppercase whitespace-nowrap transition-all outline-none select-none shadow-comic-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-comic active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "bg-white text-ink hover:bg-paper",
        blue: "bg-bam text-white",
        jade: "bg-jade text-white",
        ghost:
          "border-transparent shadow-none hover:shadow-none hover:translate-0 hover:bg-ink/5 active:translate-0",
        destructive: "bg-destructive text-white",
        link: "border-transparent shadow-none hover:shadow-none hover:translate-0 active:translate-0 text-bam underline-offset-4 hover:underline normal-case font-sans font-bold tracking-normal",
      },
      size: {
        default: "h-10 gap-2 px-4 text-lg",
        xs: "h-7 gap-1 px-2 text-sm [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 text-base [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 text-2xl [&_svg:not([class*='size-'])]:size-5",
        xl: "h-16 gap-3 px-8 text-3xl [&_svg:not([class*='size-'])]:size-6",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
