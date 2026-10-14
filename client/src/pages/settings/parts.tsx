import { Check } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

export function SettingsSection({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
          {description && <p className="max-w-2xl text-sm leading-relaxed text-ink-2">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-3xl bg-surface p-5 shadow-card sm:p-6", className)}>{children}</div>
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: React.ReactNode
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-ink-3">{hint}</p>}
    </div>
  )
}

/** Barra fixa no rodapé com "Descartar" e "Salvar", visível só quando há mudanças. */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onReset,
}: {
  dirty: boolean
  saving: boolean
  onSave: () => void
  onReset: () => void
}) {
  if (!dirty) return null
  return (
    <div className="sticky bottom-4 z-10 flex animate-pop-in items-center justify-between gap-3 rounded-full bg-ink py-2 pr-2 pl-5 text-sm text-white shadow-pop">
      <span>Há alterações não salvas.</span>
      <span className="flex gap-2">
        <Button size="sm" variant="ghost" className="text-white/80 hover:bg-white/10 hover:text-white" onClick={onReset}>
          Descartar
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </span>
    </div>
  )
}

const COLOR_PRESETS = [
  { name: "Violeta", value: "#7c3aed" },
  { name: "Índigo", value: "#4f46e5" },
  { name: "Azul", value: "#2563eb" },
  { name: "Ciano", value: "#0891b2" },
  { name: "Verde-azulado", value: "#0d9488" },
  { name: "Verde", value: "#16a34a" },
  { name: "Rosa", value: "#db2777" },
  { name: "Grafite", value: "#334155" },
]

/** Escolha de cor: atalhos prontos + seletor livre do navegador. */
export function ColorField({
  value,
  onChange,
  presets = COLOR_PRESETS,
  label,
}: {
  value: string
  onChange: (hex: string) => void
  presets?: { name: string; value: string }[]
  label: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={label}>
      {presets.map((p) => {
        const selected = p.value.toLowerCase() === value.toLowerCase()
        return (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={p.name}
            onClick={() => onChange(p.value)}
            className={cn(
              "grid size-8 place-items-center rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-4 focus-visible:ring-brand-100",
              selected && "ring-2 ring-ink ring-offset-2 ring-offset-surface"
            )}
            style={{ backgroundColor: p.value }}
          >
            {selected && <Check className="size-4 text-white" strokeWidth={3} />}
          </button>
        )
      })}
      <label
        className="relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full bg-[conic-gradient(#f43f5e,#f59e0b,#22c55e,#06b6d4,#6366f1,#d946ef,#f43f5e)] transition-transform hover:scale-110"
        title="Outra cor"
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={`${label}: outra cor`}
        />
      </label>
      <span className="ml-1 font-mono text-xs text-ink-3 uppercase">{value}</span>
    </div>
  )
}
