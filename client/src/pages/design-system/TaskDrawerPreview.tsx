import { useState } from "react"
import { CalendarDays, Flag, Send, Tag, Undo2, UserRound } from "lucide-react"
import { cn } from "cn"

import { StatusIcon } from "@/components/task/StatusIcon"
import { CategoryChip, PriorityDot, UserAvatar } from "@/components/task/TaskMeta"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { formatLongDate } from "@/lib/dates"
import { sampleChecklist, sampleHistory, sampleTasks, users } from "./sampleData"

/** Prévia visual do painel lateral da tarefa (a versão funcional vem na fase 5). */
export function TaskDrawerPreview() {
  const task = sampleTasks.returned
  const [items, setItems] = useState(sampleChecklist)
  const done = items.filter((i) => i.done).length
  const pct = Math.round((done / items.length) * 100)

  return (
    <SheetContent>
      <SheetHeader>
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-3">
          <span className="tabular-nums">TI-{task.id}</span>
          <span className="size-1 rounded-full bg-ink-4" />
          <span className="inline-flex items-center gap-1.5">
            <StatusIcon status={task.status} className="size-3.5" /> Em andamento
          </span>
        </div>
        <SheetTitle>{task.title}</SheetTitle>
        <SheetDescription>Criada por Marcos Almeida em 6 de outubro</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-7 overflow-y-auto px-7 py-4">
        <div className="flex gap-2.5 rounded-2xl bg-warning-soft px-4 py-3 text-[13px] leading-relaxed">
          <Undo2 className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-ink-2">
            <span className="font-semibold text-warning">Devolvida por Marcos</span> · {task.lastReturnReason}
          </p>
        </div>

        <dl className="grid grid-cols-[120px_1fr] items-center gap-x-4 gap-y-3 text-[13px]">
          <Prop icon={<UserRound />} label="Responsável">
            <span className="inline-flex items-center gap-2 font-medium text-ink">
              <UserAvatar user={users.juliana} size="sm" withTooltip={false} />
              Juliana Souza
            </span>
          </Prop>
          <Prop icon={<Flag />} label="Prioridade">
            <PriorityDot priority={task.priority} showLabel />
          </Prop>
          <Prop icon={<CalendarDays />} label="Prazo">
            <span className="font-medium text-ink first-letter:uppercase">{formatLongDate(task.dueDate)}</span>
          </Prop>
          <Prop icon={<Tag />} label="Categoria">
            <CategoryChip category={task.category} className="h-6" />
          </Prop>
        </dl>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Descrição</h3>
          <p className="text-sm leading-relaxed text-ink-2">
            Mover as 14 caixas do financeiro para o novo tenant, mantendo regras de encaminhamento e
            assinaturas. Janela combinada: sexta após as 18h.
          </p>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Checklist de pronto</h3>
            <span className={cn("text-xs font-semibold tabular-nums", pct === 100 ? "text-success" : "text-ink-3")}>
              {done}/{items.length}
            </span>
          </div>
          <Progress value={pct} />
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-sunken">
                  <Checkbox
                    checked={item.done}
                    onCheckedChange={(v) =>
                      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: v === true } : i)))
                    }
                  />
                  <span
                    className={cn(
                      "text-sm transition-colors",
                      item.done ? "text-ink-3 line-through decoration-ink-4" : "text-ink"
                    )}
                  >
                    {item.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Histórico</h3>
          <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-hairline">
            {sampleHistory.map((event) => (
              <li key={event.id} className="relative flex gap-3">
                <UserAvatar user={event.who} size="sm" withTooltip={false} />
                <div className="min-w-0 flex-1 pt-0.5 text-[13px] leading-relaxed">
                  <p className="text-ink-2">
                    <span className="font-semibold text-ink">{event.who.name.split(" ")[0]}</span> {event.text}
                    <span className="ml-1.5 text-xs text-ink-3">{event.when}</span>
                  </p>
                  {"reason" in event && (
                    <p className="mt-1.5 rounded-xl bg-surface-sunken px-3 py-2 text-ink-2">“{event.reason}”</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <SheetFooter className="border-t border-hairline">
        <span className="text-xs text-ink-3">
          {pct === 100 ? "Checklist completo. Pode enviar." : `Faltam ${items.length - done} itens para a Revisão`}
        </span>
        <Button className="ml-auto" disabled={pct !== 100}>
          <Send /> Enviar para revisão
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}

function Prop({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="flex items-center gap-2 text-ink-3 [&_svg]:size-4">
        {icon}
        {label}
      </dt>
      <dd>{children}</dd>
    </>
  )
}
