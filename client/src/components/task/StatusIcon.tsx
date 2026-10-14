import { cn } from "cn"
import type { TaskStatus } from "@/lib/domain"

/**
 * Ícone de status em anel (estilo Linear): o preenchimento indica o avanço.
 * Roxo marca estados ativos; verde só no concluído; vermelho só no bloqueio.
 */
export function StatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  const common = cn("size-4 shrink-0", className)

  switch (status) {
    case "todo":
      return (
        <svg viewBox="0 0 16 16" className={cn(common, "text-ink-4")} aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      )
    case "in_progress":
      return (
        <svg viewBox="0 0 16 16" className={cn(common, "text-brand-500")} aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path d="M8 4.5 A3.5 3.5 0 0 1 8 11.5 Z" fill="currentColor" />
        </svg>
      )
    case "review":
      return (
        <svg viewBox="0 0 16 16" className={cn(common, "text-brand-600")} aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path d="M8 4.5 A3.5 3.5 0 1 1 4.5 8 L8 8 Z" fill="currentColor" />
        </svg>
      )
    case "done":
      return (
        <svg viewBox="0 0 16 16" className={cn(common, "text-success")} aria-hidden>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M5 8.2 7 10.2 11 6" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case "blocked":
      return (
        <svg viewBox="0 0 16 16" className={cn(common, "text-danger")} aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path d="M4 12 12 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      )
  }
}
