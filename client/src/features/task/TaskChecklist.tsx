import { useState } from "react"
import { Lock, Plus, X } from "lucide-react"
import { checkChecklistEditable, checkChecklistItemRemoval, type TaskDetailDTO, type UserDTO } from "@tarefas/shared"
import { cn } from "cn"

import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useChecklist } from "./useTaskDetail"

export function TaskChecklist({ task, me }: { task: TaskDetailDTO; me: UserDTO }) {
  const { toggle, add, remove } = useChecklist(task.id, me.id)
  const [draft, setDraft] = useState("")

  const editable = checkChecklistEditable(task.status)
  const done = task.checklistDone
  const total = task.checklistTotal
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const submit = () => {
    const label = draft.trim()
    if (!label) return
    add.mutate(label, { onSuccess: () => setDraft("") })
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Checklist de pronto</h3>
        <span className={cn("text-xs font-semibold tabular-nums", pct === 100 ? "text-success" : "text-ink-3")}>
          {done}/{total}
        </span>
      </div>
      <Progress value={pct} className={cn(pct === 100 && "[&>[data-slot=progress-indicator]]:bg-success")} />

      {!editable.ok && (
        <p className="flex items-center gap-2 rounded-xl bg-surface-sunken px-3 py-2 text-xs text-ink-2">
          <Lock className="size-3.5 shrink-0 text-ink-3" />
          {editable.message}
        </p>
      )}

      <ul className="space-y-0.5">
        {task.checklist.map((item) => {
          const canRemove = editable.ok && checkChecklistItemRemoval(me.role, item.isFromTemplate).ok
          return (
            <li key={item.id} className="group/item flex items-center gap-1 rounded-xl pr-1 transition-colors hover:bg-surface-sunken">
              <label className={cn("flex min-w-0 flex-1 items-center gap-3 px-2 py-2", editable.ok && "cursor-pointer")}>
                <Checkbox
                  checked={item.isDone}
                  disabled={!editable.ok}
                  onCheckedChange={(v) => toggle.mutate({ item, isDone: v === true })}
                />
                <span
                  className={cn(
                    "text-sm transition-colors",
                    item.isDone ? "text-ink-3 line-through decoration-ink-4" : "text-ink"
                  )}
                >
                  {item.label}
                </span>
              </label>
              {item.isFromTemplate && !canRemove && editable.ok ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="grid size-7 place-items-center text-ink-4 opacity-0 transition-opacity group-hover/item:opacity-100">
                      <Lock className="size-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Item padrão da categoria: só o gestor remove</TooltipContent>
                </Tooltip>
              ) : canRemove ? (
                <button
                  type="button"
                  onClick={() => remove.mutate(item)}
                  aria-label={`Remover "${item.label}"`}
                  className="grid size-7 place-items-center rounded-full text-ink-3 opacity-0 transition-[opacity,background-color] group-hover/item:opacity-100 hover:bg-danger-soft hover:text-danger focus-visible:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>

      {editable.ok && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm focus-within:bg-surface-sunken"
        >
          <Plus className="size-[18px] shrink-0 text-ink-3" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Adicionar item"
            maxLength={200}
            className="h-7 min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3"
          />
          {draft.trim() && <span className="text-xs text-ink-3">Enter</span>}
        </form>
      )}
    </section>
  )
}
