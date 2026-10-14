import { Plus } from "lucide-react"
import { cn } from "cn"

import { EmptyColumn } from "@/components/empty-states/EmptyColumn"
import { StatusIcon } from "@/components/task/StatusIcon"
import { Button } from "@/components/ui/button"
import { useAppConfig } from "@/features/settings/appConfig"
import type { TaskStatus } from "@/lib/domain"

export type DropState = "idle" | "accept" | "deny"

/**
 * Largura da coluna: fixa no celular (rola para o lado); a partir de lg as colunas dividem a
 * largura da tela — encolhem no notebook para caberem todas e crescem no monitor grande.
 */
export const COLUMN_WIDTH = "w-[300px] shrink-0 lg:w-auto lg:min-w-[220px] lg:max-w-[520px] lg:flex-1 lg:basis-0"

interface BoardColumnProps {
  status: TaskStatus
  count: number
  /** Durante um arraste: a coluna aceita (acende) ou recusa (apaga) o card. */
  dropState?: DropState
  denyReason?: string
  onAdd?: () => void
  children?: React.ReactNode
  className?: string
  ref?: React.Ref<HTMLElement>
  /** Há filtros ativos: a coluna vazia explica isso em vez de mostrar a ilustração. */
  filtered?: boolean
}

export function BoardColumn({
  status,
  count,
  dropState = "idle",
  denyReason,
  onAdd,
  children,
  className,
  ref,
  filtered,
}: BoardColumnProps) {
  const label = useAppConfig().statusLabel(status)

  return (
    <section
      ref={ref}
      aria-label={label}
      className={cn(
        COLUMN_WIDTH,
        "flex min-h-0 flex-col rounded-3xl bg-surface-sunken/80 p-2 transition-[background-color,box-shadow,opacity] duration-200",
        dropState === "accept" && "bg-brand-50 shadow-[inset_0_0_0_2px_var(--brand-200)]",
        dropState === "deny" && "opacity-55",
        className
      )}
    >
      <header className="flex h-10 items-center gap-2 px-2.5">
        <StatusIcon status={status} />
        <h2 className="text-[13px] font-semibold text-ink">{label}</h2>
        <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-3 tabular-nums shadow-[0_0_0_1px_var(--hairline)]">
          {count}
        </span>
        {onAdd && (
          <Button variant="ghost" size="icon-xs" className="ml-auto" onClick={onAdd} aria-label="Nova tarefa">
            <Plus />
          </Button>
        )}
      </header>

      {dropState === "deny" && denyReason && (
        <p className="mx-1 mb-2 rounded-xl bg-surface px-3 py-2 text-xs text-ink-2 shadow-card">{denyReason}</p>
      )}

      <div className="scroll-soft flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-1">
        {count === 0 && !children ? (
          filtered ? (
            <p className="px-4 py-8 text-center text-xs leading-relaxed text-ink-3">Nenhum card com esses filtros.</p>
          ) : (
            <EmptyColumn status={status} />
          )
        ) : (
          children
        )}
      </div>
    </section>
  )
}
