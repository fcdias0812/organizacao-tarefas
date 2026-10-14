import * as React from "react"
import { cn } from "cn"
import { DayPicker, getDefaultClassNames, type DayButton } from "react-day-picker"
import { ptBR } from "react-day-picker/locale"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

/** Calendário em português, no visual do design system (dias redondos, violeta no selecionado). */
function Calendar({ className, classNames, showOutsideDays = true, components, ...props }: React.ComponentProps<typeof DayPicker>) {
  const d = getDefaultClassNames()

  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      className={cn("p-1 [--cell-size:--spacing(9)]", className)}
      classNames={{
        root: cn("w-fit", d.root),
        months: cn("relative flex flex-col gap-4", d.months),
        month: cn("flex w-full flex-col gap-3", d.month),
        nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between", d.nav),
        button_previous: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "aria-disabled:opacity-40", d.button_previous),
        button_next: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "aria-disabled:opacity-40", d.button_next),
        month_caption: cn("flex h-8 items-center justify-center", d.month_caption),
        caption_label: cn("text-sm font-semibold text-ink first-letter:uppercase select-none", d.caption_label),
        month_grid: cn("w-full border-collapse", d.month_grid),
        weekdays: cn("flex", d.weekdays),
        weekday: cn("w-(--cell-size) text-[11px] font-semibold text-ink-3 uppercase select-none", d.weekday),
        week: cn("mt-1 flex w-full", d.week),
        day: cn("relative size-(--cell-size) p-0 text-center select-none", d.day),
        today: cn("[&>button]:font-semibold [&>button]:text-brand-700 [&>button]:ring-1 [&>button]:ring-brand-200", d.today),
        outside: cn("[&>button]:text-ink-4", d.outside),
        disabled: cn("opacity-40", d.disabled),
        hidden: cn("invisible", d.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...rest }) =>
          orientation === "left" ? (
            <ChevronLeftIcon className={cn("size-4", className)} {...rest} />
          ) : (
            <ChevronRightIcon className={cn("size-4", className)} {...rest} />
          ),
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({ className, day: _day, modifiers, ...props }: React.ComponentProps<typeof DayButton>) {
  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      type="button"
      data-selected={modifiers.selected || undefined}
      className={cn(
        "grid size-(--cell-size) place-items-center rounded-full text-sm text-ink outline-none transition-colors hover:bg-surface-sunken focus-visible:ring-4 focus-visible:ring-brand-100",
        "data-selected:bg-brand-600 data-selected:font-semibold data-selected:text-white data-selected:shadow-brand data-selected:ring-0 data-selected:hover:bg-brand-700",
        className
      )}
      {...props}
    />
  )
}

export { Calendar }
