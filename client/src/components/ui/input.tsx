import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl bg-surface-sunken px-3.5 text-sm text-ink transition-[background-color,box-shadow] duration-200 outline-none placeholder:text-ink-3 hover:bg-[#f1f1f4] focus-visible:bg-surface focus-visible:shadow-[0_0_0_1px_var(--brand-300),0_0_0_4px_var(--brand-100)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:bg-danger-soft aria-invalid:shadow-[0_0_0_1px_var(--danger)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
