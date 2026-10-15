import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CornerDownLeft, Plus, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Dialog as DialogPrimitive } from "radix-ui"
import {
  checkAssign,
  parseQuickTask,
  quickSuggestions,
  type CreateTaskInput,
  type QuickSuggestion,
  type TaskPriority,
  type TaskDetailDTO,
  type TaskSummaryDTO,
  type UserDTO,
} from "@tarefas/shared"
import { cn } from "cn"

import { AssigneeAvatars, CategoryLabel, PriorityDot, UserAvatar } from "@/components/task/TaskMeta"
import { Kbd } from "@/components/ui/kbd"
import { useAppConfig } from "@/features/settings/appConfig"
import { api } from "@/lib/api"
import { formatDueLabel } from "@/lib/dates"
import { joinNames } from "@/lib/domain"
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
  // Esc com a lista de sugestões aberta fecha só a lista, não a janela.
  const escapeRef = useRef<(() => boolean) | null>(null)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/15 backdrop-blur-[2px] duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => {
            if (escapeRef.current?.()) e.preventDefault()
          }}
          className="fixed top-[16vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-3xl bg-surface p-2 shadow-pop outline-none duration-200 ease-(--ease-out-soft) data-open:animate-in data-open:fade-in-0 data-open:zoom-in-96 data-open:slide-in-from-top-2 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-96"
        >
          <DialogPrimitive.Title className="sr-only">Nova tarefa</DialogPrimitive.Title>
          {open && (
            <QuickCreateForm
              me={me}
              users={users}
              onDone={() => onOpenChange(false)}
              onCreated={onCreated}
              escapeRef={escapeRef}
            />
          )}
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
  escapeRef,
}: {
  me: UserDTO
  users: UserDTO[]
  onDone: () => void
  onCreated: (task: TaskDetailDTO, options: { open: boolean }) => void
  escapeRef: React.RefObject<(() => boolean) | null>
}) {
  const [text, setText] = useState("")
  const [caret, setCaret] = useState(0)
  const [today] = useState(() => new Date())
  const create = useCreateTask()
  const inputRef = useRef<HTMLInputElement>(null)

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
  // Sem @: só quem está criando. Vários @ = vários responsáveis.
  const assigneeIds = parsed.assigneeIds ?? [me.id]
  const assignees = assigneeIds.map((id) => (id === me.id ? me : users.find((u) => u.id === id))).filter((u) => u !== undefined)
  const assignCheck = checkAssign(me, [], assigneeIds)
  const canSubmit = parsed.title.trim().length > 0 && assignCheck.ok && !!category && !create.isPending

  // Sugestões do atalho sob o cursor (#categoria, !prioridade, @pessoa).
  const suggestions = useMemo(
    () => quickSuggestions(text, caret, { users, categories, priorityLabels }),
    [text, caret, users, categories, priorityLabels]
  )
  const suggestionKey = suggestions ? `${suggestions.start}:${text.slice(suggestions.start, suggestions.end)}` : ""
  const [highlight, setHighlight] = useState({ key: "", index: 0 })
  const [dismissedKey, setDismissedKey] = useState("")
  const listOpen = !!suggestions && dismissedKey !== suggestionKey
  const activeIndex = highlight.key === suggestionKey ? highlight.index : 0

  useEffect(() => {
    escapeRef.current = () => {
      if (!listOpen) return false
      setDismissedKey(suggestionKey)
      return true
    }
  }, [escapeRef, listOpen, suggestionKey])

  const choose = (item: QuickSuggestion) => {
    if (!suggestions) return
    const after = text.slice(suggestions.end)
    const next = `${text.slice(0, suggestions.start)}${item.token}${after.startsWith(" ") ? "" : " "}${after}`
    const position = suggestions.start + item.token.length + 1
    setText(next)
    setCaret(position)
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(position, position))
  }

  const submit = (keepOpen: boolean) => {
    if (!canSubmit || !category) return
    create.mutate(
      { title: parsed.title, category, priority, assigneeIds, dueDate: parsed.dueDate ?? null },
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
          ref={inputRef}
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setCaret(e.target.selectionStart ?? e.target.value.length)
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={(e) => {
            if (listOpen && suggestions) {
              const count = suggestions.items.length
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault()
                const step = e.key === "ArrowDown" ? 1 : -1
                setHighlight({ key: suggestionKey, index: (activeIndex + step + count) % count })
                return
              }
              if (e.key === "Enter" || e.key === "Tab") {
                // Com a lista aberta, Enter/Tab completam o atalho em vez de criar.
                e.preventDefault()
                choose(suggestions.items[activeIndex])
                return
              }
            }
            if (e.key === "Enter" && e.shiftKey) {
              e.preventDefault()
              submit(true)
            }
          }}
          maxLength={260}
          placeholder="O que precisa ser feito?"
          aria-label="Nova tarefa"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listOpen}
          aria-controls={listOpen ? "quick-suggestions" : undefined}
          aria-activedescendant={listOpen ? `quick-suggestion-${activeIndex}` : undefined}
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
        {create.isPending && (
          <span className="size-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" aria-label="Criando" />
        )}
      </div>

      {listOpen && suggestions && (
        <ul
          id="quick-suggestions"
          role="listbox"
          aria-label="Sugestões de atalho"
          className="mx-2 mb-2 animate-pop-in rounded-xl bg-surface p-1 shadow-card"
        >
          {suggestions.items.map((item, index) => (
            <li
              key={`${item.kind}:${item.value}`}
              id={`quick-suggestion-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              // mousedown: escolhe sem tirar o foco do campo.
              onMouseDown={(e) => {
                e.preventDefault()
                choose(item)
              }}
              onMouseEnter={() => setHighlight({ key: suggestionKey, index })}
              className={cn(
                "flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-ink",
                index === activeIndex && "bg-brand-50"
              )}
            >
              <SuggestionLabel item={item} users={users} />
              <span className="ml-auto font-mono text-xs text-ink-3">{item.token}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-1.5 border-t border-hairline px-3 pt-2.5 pb-1.5">
        {category && (
          <Chip active={!!parsed.category}>
            <CategoryLabel category={category} className={parsed.category ? "text-ink-2" : "text-ink-3"} />
          </Chip>
        )}
        <Chip active={!!parsed.priority}>
          <PriorityDot priority={priority} showLabel className={parsed.priority ? "" : "text-ink-3"} />
        </Chip>
        <Chip active={parsed.assigneeIds !== undefined} danger={!assignCheck.ok}>
          <AssigneeAvatars users={assignees} avatarClassName="size-5" />
          {joinNames(assignees.map((u) => (u.id === me.id ? "Você" : u.name.split(" ")[0])))}
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
          <code className="text-ink-2">@{me.name.split(" ")[0].toLowerCase()}</code> (um ou mais) e prazos como{" "}
          <code className="text-ink-2">amanhã</code>, <code className="text-ink-2">sexta</code> ou{" "}
          <code className="text-ink-2">20/10</code>. Sem atalhos: {defaultCategory ? config.category(defaultCategory).label : "primeira categoria"},
          prioridade {config.priority("medium").label.toLowerCase()}, para você.
        </p>
      )}
    </form>
  )
}

function SuggestionLabel({ item, users }: { item: QuickSuggestion; users: UserDTO[] }) {
  if (item.kind === "category") return <CategoryLabel category={item.value} className="text-sm text-ink" />
  if (item.kind === "priority") return <PriorityDot priority={item.value as TaskPriority} showLabel className="text-sm text-ink" />
  const user = users.find((u) => String(u.id) === item.value)
  return (
    <span className="inline-flex items-center gap-2">
      {user && <UserAvatar user={user} size="sm" withTooltip={false} className="size-5 ring-0" />}
      {item.label}
    </span>
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
