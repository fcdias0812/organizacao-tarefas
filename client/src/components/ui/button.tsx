import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full text-sm font-medium whitespace-nowrap select-none outline-none transition-[background-color,box-shadow,color,transform] duration-200 ease-(--ease-out-soft) focus-visible:ring-4 focus-visible:ring-brand-200 active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:bg-surface-sunken disabled:text-ink-4 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-brand-600 text-white shadow-brand hover:bg-brand-700 hover:shadow-brand-strong",
        soft: "bg-brand-50 text-brand-700 hover:bg-brand-100",
        secondary: "bg-surface-sunken text-ink hover:bg-[#ededf1]",
        outline:
          "bg-surface text-ink shadow-card hover:shadow-card-hover aria-expanded:shadow-card-hover",
        ghost:
          "text-ink-2 hover:bg-surface-sunken hover:text-ink aria-expanded:bg-surface-sunken aria-expanded:text-ink",
        success:
          "bg-success text-white shadow-[0_1px_2px_rgb(31_157_85/0.2),0_6px_16px_-4px_rgb(31_157_85/0.45)] hover:bg-[#1a8a4a]",
        warning: "bg-warning-soft text-warning hover:bg-[#fdecc8] focus-visible:ring-warning/20",
        destructive:
          "bg-danger-soft text-danger hover:bg-[#fbe2e2] focus-visible:ring-danger/20",
        link: "rounded-md text-brand-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-2 px-4",
        xs: "h-7 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 text-[15px]",
        icon: "size-9",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
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
