import { cn } from "cn"
import { STATUS_META, type TaskStatus } from "@/lib/domain"

/** Estado vazio da coluna: ilustração leve + texto que orienta o próximo passo. */
export function EmptyColumn({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = STATUS_META[status]
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl px-6 py-10 text-center",
        className
      )}
    >
      <EmptyIllustration status={status} />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">{meta.emptyTitle}</p>
        <p className="mx-auto max-w-[200px] text-xs leading-relaxed text-ink-3">{meta.emptyHint}</p>
      </div>
    </div>
  )
}

function EmptyIllustration({ status }: { status: TaskStatus }) {
  // "Bloqueado" e "Concluído" vazios são boas notícias: selo verde com check.
  const positive = status === "blocked" || status === "done"

  return (
    <svg viewBox="0 0 120 88" className="h-[76px] w-auto animate-float" aria-hidden>
      {/* halo */}
      <ellipse cx="60" cy="80" rx="34" ry="4" fill="var(--hairline)" />
      <circle cx="60" cy="40" r="36" fill="var(--brand-50)" />
      {/* card de trás */}
      <rect x="34" y="18" width="52" height="34" rx="8" fill="white" stroke="var(--brand-200)" strokeWidth="1.5" transform="rotate(-8 60 35)" />
      {/* card da frente */}
      <g filter="url(#empty-shadow)">
        <rect x="30" y="28" width="60" height="38" rx="9" fill="white" />
      </g>
      <rect x="38" y="37" width="26" height="4" rx="2" fill="var(--brand-200)" />
      <rect x="38" y="46" width="40" height="4" rx="2" fill="var(--hairline)" />
      <circle cx="80" cy="58" r="4" fill="var(--brand-100)" />
      {/* selo */}
      <circle cx="88" cy="28" r="9" fill={positive ? "var(--success)" : "var(--brand-500)"} />
      {positive ? (
        <path d="M84 28.2 87 31 92 25.5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M88 24v8M84 28h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
      )}
      {/* brilhos */}
      <path d="M24 22l1.5 3.5L29 27l-3.5 1.5L24 32l-1.5-3.5L19 27l3.5-1.5z" fill="var(--brand-300)" />
      <circle cx="100" cy="52" r="2" fill="var(--brand-300)" />
      <defs>
        <filter id="empty-shadow" x="20" y="22" width="80" height="58" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#4c1d95" floodOpacity="0.12" />
        </filter>
      </defs>
    </svg>
  )
}
