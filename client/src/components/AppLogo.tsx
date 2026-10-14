import { cn } from "cn"

export function AppLogo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid size-8 place-items-center rounded-[10px] bg-brand-600 shadow-brand">
        <svg viewBox="0 0 20 20" className="size-[18px]" aria-hidden>
          <rect x="3" y="3" width="6" height="14" rx="2" fill="white" fillOpacity="0.55" />
          <rect x="11" y="3" width="6" height="9" rx="2" fill="white" />
        </svg>
      </span>
      {showName && (
        <span className="text-[15px] font-semibold tracking-tight whitespace-nowrap text-ink">
          Tarefas <span className="text-ink-3">TI</span>
        </span>
      )}
    </span>
  )
}
