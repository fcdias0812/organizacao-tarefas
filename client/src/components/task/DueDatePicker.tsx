import { useState } from "react"
import { CalendarDays } from "lucide-react"
import { cn } from "cn"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { addDays, formatDueLabel, getDueState, parseDateOnly, toDateOnly } from "@/lib/dates"

const longFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short" })

interface DueDatePickerProps {
  value: string | null
  onChange: (value: string | null) => void
  /** Em cards concluídos o prazo não chama atenção. */
  muted?: boolean
  className?: string
}

export function DueDatePicker({ value, onChange, muted, className }: DueDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [today] = useState(() => new Date())
  const state = value && !muted ? getDueState(value, today) : "normal"

  const pick = (next: string | null) => {
    onChange(next)
    setOpen(false)
  }

  const shortcuts = [
    { label: "Hoje", value: toDateOnly(today) },
    { label: "Amanhã", value: toDateOnly(addDays(today, 1)) },
    { label: "+1 semana", value: toDateOnly(addDays(today, 7)) },
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Prazo"
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-full px-2.5 text-sm outline-none transition-colors hover:bg-surface-sunken focus-visible:ring-4 focus-visible:ring-brand-100 data-[state=open]:bg-surface-sunken",
          !value && "text-ink-3",
          value && "text-ink",
          className
        )}
      >
        {value ? (
          <>
            <span className="first-letter:uppercase">{longFormat.format(parseDateOnly(value)).replace(/\./g, "")}</span>
            {state !== "normal" && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  state === "overdue" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"
                )}
              >
                {formatDueLabel(value, today)}
              </span>
            )}
          </>
        ) : (
          <>
            <CalendarDays className="size-4" /> Sem prazo
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <div className="flex flex-wrap gap-1.5 pb-2">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => pick(s.value)}
              className={cn(
                "h-7 rounded-full px-3 text-xs font-medium transition-colors",
                value === s.value ? "bg-brand-600 text-white" : "bg-surface-sunken text-ink-2 hover:bg-brand-50 hover:text-brand-700"
              )}
            >
              {s.label}
            </button>
          ))}
          {value && (
            <button
              type="button"
              onClick={() => pick(null)}
              className="h-7 rounded-full px-3 text-xs font-medium text-ink-3 transition-colors hover:bg-danger-soft hover:text-danger"
            >
              Sem prazo
            </button>
          )}
        </div>
        <Calendar
          mode="single"
          selected={value ? parseDateOnly(value) : undefined}
          defaultMonth={value ? parseDateOnly(value) : today}
          onSelect={(date) => date && pick(toDateOnly(date))}
        />
      </PopoverContent>
    </Popover>
  )
}
