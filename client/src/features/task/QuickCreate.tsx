import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CornerDownLeft, Plus, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Dialog as DialogPrimitive } from "radix-ui"
import {
  checkAssign,
  parseQuickTask,
  type CreateTaskInput,
  type TaskDetailDTO,
  type TaskSummaryDTO,
  type UserDTO,
} from "@tarefas/shared"
import { cn } from "cn"

import { CategoryLabel, PriorityDot, UserAvatar } from "@/components/task/TaskMeta"
import { Kbd } from "@/components/ui/kbd"
import { useAppConfig } from "@/features/settings/appConfig"
import { api } from "@/lib/api"
import { formatDueLabel } from "@/lib/dates"
import { queryKeys } from "@/lib/queryClient"

interface QuickCreateProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  me: UserDTO
  users: UserDTO[]
  onCreated: (task: TaskDetailDTO, options: { open: boolean }) => void
}

function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<CreateTaskInput> & Pick<CreateTaskInput, "title" | "category">) =>
      api<{ task: TaskDetailDTO }>("POST", "/tasks", input),
    onSuccess: ({ task }) => {
      const { checklist: _c, events: _e, ...summary } = task
      queryClient.setQueryData<TaskSummaryDTO[]>(queryKeys.tasks, (list) => (list ? [...list, summary] : list))
      queryClient.setQueryData(queryKeys.task(task.id), task)
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks })
    },
  })
}

/**
 * Criação rápida (tecla N): um campo só. Atalhos opcionais na mesma linha —
 * #categoria, !prioridade, @pessoa e prazo — viram selos abaixo do campo.
 */
export function QuickCreate({ open, onOpenChange, me, users, onCreated }: QuickCreateProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/15 backdrop-blur-[2px] duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[16vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-3xl bg-surface p-2 shadow-pop outline-none duration-200 ease-(--ease-out-soft) data-open:animate-in data-open:fade-in-0 data-open:zoom-in-96 data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-96"
        >
          <DialogPrimitive.Title className="sr-only">Nova tarefa</DialogPrimitive.Title>
          {open && <QuickCreateForm me={me} users={users} onDone={() => onOpenChange(false)} onCreated={onCreated} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function QuickCreateForm({
  me,
  users,
  onDone,
  onCreated,
}: {
  me: UserDTO
  users: UserDTO[]
  onDone: () => void
  onCreated: (task: TaskDetailDTO, options: { open: boolean }) => void
}) {
  const [text, setText] = useState("")
  const [today] = useState(() => new Date())
  const create = useCreateTask()

  const config = useAppConfig()
  const categories = config.activeCategories
  const priorityLabels = useMemo(
    () => Object.fromEntries(Object.entries(config.settings.priorities).map(([k, v]) => [k, v.label])),
    [config.settings.priorities]
  )
  const parsed = useMemo(
    () => parseQuickTask(text, { users, categories, priorityLabels, today }),
    [text, users, categories, priorityLabels, today]
  )
  // Sem #categoria: a primeira categoria ativa da lista (ordem definida em Configurações).
  const defaultCategory = categories[0]?.key
  const category = parsed.category ?? defaultCategory
  const priority = parsed.priority ?? "medium"
  const assigneeId = parsed.assigneeId ?? me.id
  const assignee = users.find((u) => u.id === assigneeId) ?? me
  const assignCheck = checkAssign(me, assigneeId)
  const canSubmit = parsed.title.trim().length > 0 && assignCheck.ok && !!category && !create.isPending

  const submit = (keepOpen: boolean) => {
    if (!canSubmit || !category) return
    create.mutate(
      { title: parsed.title, category, priority, assigneeId, dueDate: parsed.dueDate ?? null },
      {
        onSuccess: ({ task }) => {
          setText("")
          toast.success("Tarefa criada", { description: task.title })
          // Enter: fecha e já abre a tarefa no painel. Shift+Enter: continua lançando.
          if (!keepOpen) onDone()
          onCreated(task, { open: !keepOpen })
        },
        onError: (error) => toast.error(error.message),
      }
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit(false)
      }}
    >
      <div className="flex items-center gap-3 px-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-white shadow-brand">
          <Plus className="size-4" />
        </span>
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.shiftKey) {
              e.preventDefault()
              submit(true)
            }
          }}
          maxLength={260}
          placeholder="O que precisa ser feito?"
          aria-label="Nova tarefa"
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
        {create.isPending && (
          <span className="size-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" aria-label="Criando" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-hairline px-3 pt-2.5 pb-1.5">
        {category && (
          <Chip active={!!parsed.category}>
            <CategoryLabel category={category} className={parsed.category ? "text-ink-2" : "text-ink-3"} />
          </Chip>
        )}
        <Chip active={!!parsed.priority}>
          <PriorityDot priority={priority} showLabel className={parsed.priority ? "" : "text-ink-3"} />
        </Chip>
        <Chip active={parsed.assigneeId !== undefined} danger={!assignCheck.ok}>
          <UserAvatar user={assignee} size="sm" withTooltip={false} className="size-5 ring-0" />
          {assignee.id === me.id ? "Você" : assignee.name.split(" ")[0]}
        </Chip>
        {parsed.dueDate && (
          <Chip active warning>
            {formatDueLabel(parsed.dueDate, today)}
          </Chip>
        )}

        <span className="ml-auto hidden items-center gap-1.5 text-xs text-ink-3 sm:inline-flex">
          <Kbd>
            <CornerDownLeft />
          </Kbd>
          criar
          <Kbd className="ml-1.5">Shift</Kbd>+<Kbd>
            <CornerDownLeft />
          </Kbd>
          criar outra
          <Kbd className="ml-1.5">Esc</Kbd>
          fechar
        </span>
      </div>

      {!assignCheck.ok ? (
        <p className="flex items-center gap-1.5 px-4 pt-1 pb-2 text-xs text-danger">
          <TriangleAlert className="size-3.5" /> {assignCheck.message}
        </p>
      ) : (
        <p className="px-4 pt-1 pb-2 text-xs text-ink-3">
          Atalhos: <code className="text-ink-2">#{(categories[1] ?? categories[0])?.name.toLowerCase().replace(/\s+/g, "") ?? "categoria"}</code>{" "}
          <code className="text-ink-2">!{config.priority("high").label.toLowerCase()}</code>{" "}
          <code className="text-ink-2">@{me.name.split(" ")[0].toLowerCase()}</code> e prazos como{" "}
          <code className="text-ink-2">amanhã</code>, <code className="text-ink-2">sexta</code> ou{" "}
          <code className="text-ink-2">20/10</code>. Sem atalhos: {defaultCategory ? config.category(defaultCategory).label : "primeira categoria"},
          prioridade {config.priority("medium").label.toLowerCase()}, para você.
        </p>
      )}
    </form>
  )
}

function Chip({
  active,
  warning,
  danger,
  children,
}: {
  active?: boolean
  warning?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 animate-pop-in items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors",
        danger
          ? "bg-danger-soft text-danger"
          : warning
            ? "bg-warning-soft text-warning"
            : active
              ? "bg-brand-50 text-brand-700"
              : "bg-surface-sunken text-ink-3"
      )}
    >
      {children}
    </span>
  )
}
