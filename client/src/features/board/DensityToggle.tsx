import { Rows2, Rows4 } from "lucide-react"
import { cn } from "cn"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { CardDensity } from "./useCardDensity"

const OPTIONS: { value: CardDensity; label: string; Icon: typeof Rows2 }[] = [
  { value: "comfortable", label: "Cards confortáveis", Icon: Rows2 },
  { value: "compact", label: "Cards compactos", Icon: Rows4 },
]

export function DensityToggle({ value, onChange }: { value: CardDensity; onChange: (value: CardDensity) => void }) {
  return (
    <div role="group" aria-label="Tamanho dos cards" className="flex h-9 shrink-0 items-center gap-0.5 rounded-full bg-surface p-1 shadow-card">
      {OPTIONS.map(({ value: option, label, Icon }) => {
        const active = option === value
        return (
          <Tooltip key={option}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={label}
                aria-pressed={active}
                onClick={() => onChange(option)}
                className={cn(
                  "grid size-7 place-items-center rounded-full outline-none transition-colors focus-visible:ring-4 focus-visible:ring-brand-100",
                  active ? "bg-brand-50 text-brand-700" : "text-ink-3 hover:text-ink"
                )}
              >
                <Icon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
