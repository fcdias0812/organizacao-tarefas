import { useState } from "react"
import { RotateCcw } from "lucide-react"
import { DEFAULT_SETTINGS, type SettingsDTO, type SettingsInput, type TaskPriority, type TaskStatus } from "@tarefas/shared"

import { AppLogo } from "@/components/AppLogo"
import { StatusIcon } from "@/components/task/StatusIcon"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAppConfig } from "@/features/settings/appConfig"
import { useUpdateSettings } from "@/features/settings/useAdmin"
import { PRIORITY_ORDER, STATUS_ORDER } from "@/lib/domain"
import { ColorField, Field, Panel, SaveBar, SettingsSection } from "./parts"

/** Rascunho local das configurações: edita à vontade e só grava ao salvar. */
function useSettingsDraft<K extends keyof SettingsDTO>(keys: K[]) {
  const { settings } = useAppConfig()
  const pick = (s: SettingsDTO) => Object.fromEntries(keys.map((k) => [k, s[k]])) as Pick<SettingsDTO, K>
  const [draft, setDraft] = useState(() => pick(settings))
  const update = useUpdateSettings()
  const dirty = JSON.stringify(draft) !== JSON.stringify(pick(settings))

  return {
    draft,
    setDraft,
    dirty,
    saving: update.isPending,
    save: () => update.mutate(draft as SettingsInput),
    reset: () => setDraft(pick(settings)),
  }
}

/* ───────────────────────── Identidade ───────────────────────── */

export function IdentityTab() {
  const form = useSettingsDraft(["appName", "brandColor"])
  const { draft, setDraft } = form

  return (
    <SettingsSection
      title="Identidade"
      description="Nome e cor principal do sistema. A cor vale para botões principais, destaques e estado ativo; os tons claros e escuros são calculados a partir dela."
    >
      <Panel className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <Field label="Nome do sistema" htmlFor="app-name" hint="Aparece no topo, no login e na aba do navegador.">
            <Input
              id="app-name"
              value={draft.appName}
              maxLength={40}
              onChange={(e) => setDraft({ ...draft, appName: e.target.value })}
            />
          </Field>
          <Field label="Cor principal">
            <ColorField label="Cor principal" value={draft.brandColor} onChange={(brandColor) => setDraft({ ...draft, brandColor })} />
          </Field>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDraft({ appName: DEFAULT_SETTINGS.appName, brandColor: DEFAULT_SETTINGS.brandColor })}
          >
            <RotateCcw /> Voltar ao padrão
          </Button>
        </div>

        {/* Prévia com a cor do rascunho, sem afetar o resto da tela antes de salvar. */}
        <div
          className="brand-scope space-y-4 rounded-2xl bg-surface-sunken p-5"
          style={{ "--brand-600": draft.brandColor } as React.CSSProperties}
        >
          <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Prévia</p>
          <PreviewLogo name={draft.appName} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm">Nova tarefa</Button>
            <Button size="sm" variant="soft">
              Enviar para revisão
            </Button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface">
            <div className="h-full w-2/3 rounded-full bg-brand-500" />
          </div>
        </div>
      </Panel>
      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onReset={form.reset} />
    </SettingsSection>
  )
}

function PreviewLogo({ name }: { name: string }) {
  const words = name.trim().split(/\s+/)
  return (
    <span className="inline-flex items-center gap-2.5">
      <AppLogo showName={false} />
      <span className="text-[15px] font-semibold tracking-tight text-ink">
        {words.length > 1 ? words.slice(0, -1).join(" ") : words[0]}
        {words.length > 1 && <span className="text-ink-3"> {words.at(-1)}</span>}
      </span>
    </span>
  )
}

/* ───────────────────────── Colunas ───────────────────────── */

const COLUMN_HINTS: Record<TaskStatus, string> = {
  todo: "Onde as tarefas novas entram.",
  in_progress: "Tarefas sendo executadas.",
  review: "Aguardando a conferência do gestor (checklist 100%).",
  done: "Aprovadas pelo gestor.",
  blocked: "Paradas por um impedimento (motivo obrigatório).",
}

export function ColumnsTab() {
  const form = useSettingsDraft(["statusLabels"])
  const { draft, setDraft } = form
  const setLabel = (status: TaskStatus, label: string) =>
    setDraft({ statusLabels: { ...draft.statusLabels, [status]: label } })

  return (
    <SettingsSection
      title="Nomes das colunas"
      description="Renomeie as colunas do quadro. As regras continuam as mesmas: por exemplo, a coluna de revisão sempre exige o checklist completo."
    >
      <Panel className="divide-y divide-hairline p-0 sm:p-0">
        {STATUS_ORDER.map((status) => (
          <div key={status} className="grid items-center gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_280px] sm:px-6">
            <div className="flex items-start gap-3">
              <StatusIcon status={status} className="mt-0.5" />
              <div>
                <p className="text-sm font-medium text-ink">{DEFAULT_SETTINGS.statusLabels[status]}</p>
                <p className="text-xs text-ink-3">{COLUMN_HINTS[status]}</p>
              </div>
            </div>
            <Input
              aria-label={`Nome da coluna ${DEFAULT_SETTINGS.statusLabels[status]}`}
              value={draft.statusLabels[status]}
              maxLength={30}
              onChange={(e) => setLabel(status, e.target.value)}
            />
          </div>
        ))}
      </Panel>
      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onReset={form.reset} />
    </SettingsSection>
  )
}

/* ───────────────────────── Prioridades ───────────────────────── */

const PRIORITY_PRESETS = [
  { name: "Vermelho", value: "#f0565b" },
  { name: "Laranja", value: "#f59e4c" },
  { name: "Amarelo", value: "#f2c94c" },
  { name: "Verde", value: "#4cc38a" },
  { name: "Azul", value: "#5b9cf0" },
  { name: "Lilás", value: "#a78bfa" },
  { name: "Cinza", value: "#c4c4cb" },
]

export function PrioritiesTab() {
  const form = useSettingsDraft(["priorities"])
  const { draft, setDraft } = form
  const set = (p: TaskPriority, patch: Partial<{ label: string; color: string }>) =>
    setDraft({ priorities: { ...draft.priorities, [p]: { ...draft.priorities[p], ...patch } } })

  return (
    <SettingsSection
      title="Prioridades"
      description="Nome e cor de cada nível. A cor aparece só como um ponto no card, para não competir com a cor principal. Os atalhos da criação rápida aceitam o nome novo (ex.: !crítica)."
    >
      <Panel className="divide-y divide-hairline p-0 sm:p-0">
        {PRIORITY_ORDER.map((p) => (
          <div key={p} className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
            <Input
              aria-label={`Nome da prioridade ${DEFAULT_SETTINGS.priorities[p].label}`}
              value={draft.priorities[p].label}
              maxLength={30}
              onChange={(e) => set(p, { label: e.target.value })}
            />
            <ColorField
              label={`Cor da prioridade ${draft.priorities[p].label}`}
              value={draft.priorities[p].color}
              presets={PRIORITY_PRESETS}
              onChange={(color) => set(p, { color })}
            />
          </div>
        ))}
      </Panel>
      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onReset={form.reset} />
    </SettingsSection>
  )
}

/* ───────────────────────── Prazos e regras ───────────────────────── */

export function RulesTab() {
  const form = useSettingsDraft(["soonDays", "reasonMinLength"])
  const { draft, setDraft } = form

  return (
    <SettingsSection title="Prazos e regras" description="Quando um prazo começa a chamar atenção e quanto texto exigir nos motivos.">
      <Panel className="grid gap-6 sm:grid-cols-2">
        <Field
          label="Avisar prazo com antecedência de"
          htmlFor="soon-days"
          hint={
            draft.soonDays === 0
              ? "O selo fica âmbar só no dia do prazo."
              : `O selo fica âmbar quando faltam ${draft.soonDays} dia${draft.soonDays > 1 ? "s" : ""} ou menos. Vencido fica vermelho.`
          }
        >
          <NumberInput id="soon-days" value={draft.soonDays} min={0} max={30} suffix="dias" onChange={(soonDays) => setDraft({ ...draft, soonDays })} />
        </Field>
        <Field
          label="Tamanho mínimo do motivo"
          htmlFor="reason-min"
          hint="Vale para bloquear e para devolver um card. Motivos curtos demais costumam não explicar nada."
        >
          <NumberInput
            id="reason-min"
            value={draft.reasonMinLength}
            min={1}
            max={100}
            suffix="caracteres"
            onChange={(reasonMinLength) => setDraft({ ...draft, reasonMinLength })}
          />
        </Field>
      </Panel>
      <SaveBar dirty={form.dirty} saving={form.saving} onSave={form.save} onReset={form.reset} />
    </SettingsSection>
  )
}

function NumberInput({
  id,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  id: string
  value: number
  min: number
  max: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value))
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
        }}
        className="w-24 tabular-nums"
      />
      <span className="text-sm text-ink-2">{suffix}</span>
    </div>
  )
}
