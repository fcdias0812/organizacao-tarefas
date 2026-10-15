import { useRef, useState } from "react"
import {
  Archive,
  ArchiveRestore,
  Ban,
  CalendarDays,
  ChevronDown,
  Check,
  CircleCheck,
  Flag,
  Hourglass,
  Play,
  RotateCcw,
  Send,
  Tag,
  Trash2,
  Undo2,
  UserRound,
} from "lucide-react"
import {
  checkArchive,
  checkAssign,
  checkChecklistEditable,
  isChecklistComplete,
  type CategoryKey,
  type TaskDetailDTO,
  type TaskPriority,
  type UpdateTaskInput,
  type UserDTO,
} from "@tarefas/shared"
import { toast } from "sonner"
import { cn } from "cn"

import { ReasonDialog, type ReasonKind } from "@/components/board/ReasonDialog"
import { DueDatePicker } from "@/components/task/DueDatePicker"
import { StatusIcon } from "@/components/task/StatusIcon"
import { AssigneeAvatars, CategoryLabel, PriorityDot, UserAvatar } from "@/components/task/TaskMeta"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useMoveTask } from "@/features/board/useMoveTask"
import { formatFullDateTime, formatRelative } from "@/lib/dates"
import { useAppConfig } from "@/features/settings/appConfig"
import { joinNames, PRIORITY_ORDER } from "@/lib/domain"
import { TaskChecklist } from "./TaskChecklist"
import { TaskActivity } from "./TaskActivity"
import { useArchiveActions } from "./useArchive"
import { useTaskDetail, useUpdateTask } from "./useTaskDetail"

interface TaskDrawerProps {
  taskId: number | null
  me: UserDTO
  users: UserDTO[]
  onClose: () => void
}

/** Detalhe da tarefa em painel lateral: abre por cima do quadro, sem trocar de página. */
export function TaskDrawer({ taskId, me, users, onClose }: TaskDrawerProps) {
  // Ao fechar, mantém a última tarefa na tela durante a animação de saída.
  const [shownId, setShownId] = useState(taskId)
  if (taskId !== null && taskId !== shownId) setShownId(taskId)
  const detail = useTaskDetail(shownId)

  return (
    <Sheet open={taskId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 sm:max-w-xl" aria-describedby={undefined}>
        {detail.data ? (
          <DrawerBody key={detail.data.id} task={detail.data} me={me} users={users} onClose={onClose} />
        ) : detail.isError ? (
          <div className="grid flex-1 place-items-center p-10 text-center">
            <div className="space-y-1">
              <SheetTitle className="text-base">Não deu para abrir a tarefa</SheetTitle>
              <SheetDescription>{detail.error.message}</SheetDescription>
            </div>
          </div>
        ) : (
          <DrawerSkeleton />
        )}
      </SheetContent>
    </Sheet>
  )
}

function DrawerBody({
  task,
  me,
  users,
  onClose,
}: {
  task: TaskDetailDTO
  me: UserDTO
  users: UserDTO[]
  onClose: () => void
}) {
  const update = useUpdateTask(task.id)
  const { move } = useMoveTask(me.role)
  const archiveActions = useArchiveActions()
  const [reasonKind, setReasonKind] = useState<ReasonKind | null>(null)
  const [pendingCategory, setPendingCategory] = useState<CategoryKey | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saved, flashSaved] = useFlash(2500)
  const isArchived = task.archivedAt !== null
  const canArchive = checkArchive(me, task).ok
  const archivedBy = users.find((u) => u.id === task.archivedById)

  const save = (patch: UpdateTaskInput) => update.mutate(patch, { onSuccess: flashSaved })
  const creator = users.find((u) => u.id === task.createdById)
  const isManager = me.role === "manager"
  const config = useAppConfig()
  const checklistEditable = checkChecklistEditable(task.status, config.ruleOptions).ok
  // A categoria atual pode estar desativada: continua aparecendo para leitura.
  const categoryOptions = config.activeCategories.some((c) => c.key === task.category)
    ? config.activeCategories
    : [...config.activeCategories, ...config.categories.filter((c) => c.key === task.category)]

  return (
    <>
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-7 pt-5 pr-16 text-xs font-medium text-ink-3">
        <span className="tabular-nums">TI-{task.id}</span>
        <span className="size-1 rounded-full bg-ink-4" />
        <span className="inline-flex items-center gap-1.5 text-ink-2">
          <StatusIcon status={task.status} className="size-3.5" />
          {config.statusLabel(task.status)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <SaveStatus pending={update.isPending} saved={saved} />
          {!isArchived && canArchive && (
            <Button
              variant="ghost"
              size="xs"
              disabled={archiveActions.archive.isPending}
              onClick={() =>
                archiveActions.archive.mutate(task.id, {
                  onSuccess: () =>
                    toast.success("Tarefa arquivada", {
                      description: "Saiu do quadro. Dá para restaurar em Arquivadas.",
                      action: { label: "Desfazer", onClick: () => archiveActions.restore.mutate(task.id) },
                    }),
                })
              }
            >
              <Archive /> Arquivar
            </Button>
          )}
        </div>
      </div>

      {/* Arquivada: tudo só para leitura até restaurar. */}
      <fieldset disabled={isArchived} className="scroll-soft min-w-0 flex-1 space-y-7 overflow-y-auto px-7 pt-3 pb-8">
        <div className="space-y-1">
          <SheetTitle className="sr-only">{task.title}</SheetTitle>
          <EditableTitle key={task.title} value={task.title} onSave={(title) => save({ title })} />
          <SheetDescription className="text-[13px]">
            Criada por {creator?.name ?? "alguém"}{" "}
            <span title={formatFullDateTime(task.createdAt)}>{formatRelative(task.createdAt)}</span>
          </SheetDescription>
        </div>

        {isArchived && (
          <Notice tone="neutral" icon={<Archive />} title="Arquivada">
            por {archivedBy?.name ?? "alguém"}{" "}
            <span title={formatFullDateTime(task.archivedAt!)}>{formatRelative(task.archivedAt!)}</span>. Fica fora do
            quadro e só para leitura; restaure para voltar a mexer nela.
          </Notice>
        )}
        {task.status === "blocked" && task.blockedReason && (
          <Notice tone="danger" icon={<Ban />} title="Bloqueada">
            {task.blockedReason}
          </Notice>
        )}
        {task.lastReturnReason && task.status !== "done" && task.status !== "blocked" && (
          <Notice tone="warning" icon={<Undo2 />} title="Devolvida pelo gestor">
            {task.lastReturnReason}
          </Notice>
        )}

        <dl className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-[13px]">
          <Property icon={<UserRound />} label="Responsáveis">
            <AssigneePicker task={task} me={me} users={users} onChange={(assigneeIds) => save({ assigneeIds })} />
          </Property>
          <Property icon={<Flag />} label="Prioridade">
            <Select value={task.priority} onValueChange={(v) => save({ priority: v as TaskPriority })}>
              <SelectTrigger size="sm" className={propertyTrigger} aria-label="Prioridade">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                {PRIORITY_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>
                    <PriorityDot priority={p} showLabel className="text-sm text-ink" />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Property>
          <Property icon={<CalendarDays />} label="Prazo">
            <DueDatePicker
              value={task.dueDate}
              muted={task.status === "done"}
              onChange={(dueDate) => save({ dueDate })}
            />
          </Property>
          <Property icon={<Tag />} label="Categoria">
            <Select
              value={task.category}
              disabled={!checklistEditable}
              onValueChange={(v) => setPendingCategory(v as CategoryKey)}
            >
              <SelectTrigger size="sm" className={propertyTrigger} aria-label="Categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                {categoryOptions.map((c) => (
                  <SelectItem key={c.key} value={c.key} disabled={!c.isActive}>
                    <CategoryLabel category={c.key} className="text-sm text-ink" />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Property>
        </dl>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Descrição</h3>
          <EditableDescription
            key={task.description}
            value={task.description}
            onSave={(description) => save({ description })}
          />
        </section>

        <TaskChecklist task={task} me={me} />

        <section className="space-y-4">
          <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Atividade</h3>
          <TaskActivity task={task} users={users} me={me} />
        </section>
      </fieldset>

      {isArchived ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-7 py-4">
          <span className="mr-auto text-xs text-ink-3">Arquivada · fora do quadro</span>
          {me.isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger-soft hover:text-danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 /> Excluir de vez
            </Button>
          )}
          {canArchive && (
            <Button
              variant="soft"
              disabled={archiveActions.restore.isPending}
              onClick={() =>
                archiveActions.restore.mutate(task.id, { onSuccess: () => toast.success("Tarefa restaurada para o quadro") })
              }
            >
              <ArchiveRestore /> Restaurar
            </Button>
          )}
        </div>
      ) : (
        <DrawerActions
          task={task}
          isManager={isManager}
          reviewLabel={config.statusLabel("review")}
          onMove={(status) => move({ task, status, index: 0 })}
          onAskReason={setReasonKind}
        />
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir de vez “{task.title}”?</DialogTitle>
            <DialogDescription>
              Apaga a tarefa com o checklist, os comentários e o histórico. Não dá para desfazer. A auditoria guarda
              apenas o registro de que ela foi excluída, por quem e quando.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              disabled={archiveActions.remove.isPending}
              onClick={() =>
                archiveActions.remove.mutate(task.id, {
                  onSuccess: () => {
                    setConfirmDelete(false)
                    onClose()
                    toast.success("Tarefa excluída de vez")
                  },
                })
              }
            >
              <Trash2 /> Excluir de vez
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonDialog
        kind={reasonKind}
        taskTitle={task.title}
        onCancel={() => setReasonKind(null)}
        onConfirm={(reason) => {
          move({ task, status: reasonKind === "block" ? "blocked" : "in_progress", index: 0, reason })
          setReasonKind(null)
        }}
      />

      <Dialog open={pendingCategory !== null} onOpenChange={(open) => !open && setPendingCategory(null)}>
        {pendingCategory && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Trocar para {config.category(pendingCategory).label}?</DialogTitle>
              <DialogDescription>
                Os itens do checklist padrão de {config.category(task.category).label} serão substituídos pelos de{" "}
                {config.category(pendingCategory).label}. Os itens que vocês adicionaram à mão continuam.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton>
              <Button
                onClick={() => {
                  save({ category: pendingCategory })
                  setPendingCategory(null)
                }}
              >
                Trocar categoria
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}

/* ───────────────────────── ações do rodapé ───────────────────────── */

function DrawerActions({
  task,
  isManager,
  reviewLabel,
  onMove,
  onAskReason,
}: {
  task: TaskDetailDTO
  isManager: boolean
  reviewLabel: string
  onMove: (status: TaskDetailDTO["status"]) => void
  onAskReason: (kind: ReasonKind) => void
}) {
  const complete = isChecklistComplete(task.checklistDone, task.checklistTotal)
  const missing = task.checklistTotal - task.checklistDone

  let hint: React.ReactNode = null
  let buttons: React.ReactNode = null

  switch (task.status) {
    case "todo":
    case "in_progress":
      hint = complete
        ? "Checklist completo. Pode enviar."
        : task.checklistTotal === 0
          ? "Adicione ao menos um item no checklist."
          : missing === 1
            ? `Falta 1 item para ${reviewLabel}.`
            : `Faltam ${missing} itens para ${reviewLabel}.`
      buttons = (
        <>
          <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => onAskReason("block")}>
            <Ban /> Bloquear
          </Button>
          {task.status === "todo" && (
            <Button variant="soft" onClick={() => onMove("in_progress")}>
              <Play /> Começar
            </Button>
          )}
          <Button disabled={!complete} onClick={() => onMove("review")}>
            <Send /> Enviar para {reviewLabel.toLowerCase()}
          </Button>
        </>
      )
      break
    case "review":
      if (isManager) {
        hint = "Confira o checklist e aprove ou devolva."
        buttons = (
          <>
            <Button variant="warning" onClick={() => onAskReason("return")}>
              <Undo2 /> Devolver
            </Button>
            <Button variant="success" onClick={() => onMove("done")}>
              <Check /> Aprovar e concluir
            </Button>
          </>
        )
      } else {
        hint = (
          <span className="inline-flex items-center gap-1.5">
            <Hourglass className="size-3.5" /> Aguardando a revisão do gestor.
          </span>
        )
      }
      break
    case "blocked":
      hint = "Resolvido o impedimento, desbloqueie para seguir."
      buttons = (
        <Button variant="soft" onClick={() => onMove("in_progress")}>
          <Play /> Desbloquear
        </Button>
      )
      break
    case "done":
      hint = (
        <span className="inline-flex items-center gap-1.5 text-success">
          <CircleCheck className="size-3.5" />
          Concluída {task.completedAt ? formatRelative(task.completedAt) : ""}
        </span>
      )
      if (isManager) {
        buttons = (
          <Button variant="outline" onClick={() => onMove("in_progress")}>
            <RotateCcw /> Reabrir
          </Button>
        )
      }
      break
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-7 py-4">
      <span className="mr-auto text-xs text-ink-3">{hint}</span>
      {buttons}
    </div>
  )
}

/* ───────────────────────── campos ───────────────────────── */

const propertyTrigger =
  "h-8 w-full max-w-64 justify-start gap-2 bg-transparent pl-2.5 hover:bg-surface-sunken data-[state=open]:bg-surface-sunken [&>svg:last-child]:ml-auto"

function Property({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="flex items-center gap-2 text-ink-3 [&_svg]:size-4">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

/**
 * Responsáveis (um ou mais): cada clique inclui ou tira uma pessoa e já salva.
 * O que a regra não permite (ex.: executor mexendo em outra pessoa) aparece desabilitado.
 */
function AssigneePicker({
  task,
  me,
  users,
  onChange,
}: {
  task: TaskDetailDTO
  me: UserDTO
  users: UserDTO[]
  onChange: (assigneeIds: number[]) => void
}) {
  const current = task.assigneeIds
  const selected = current.map((id) => users.find((u) => u.id === id)).filter((u) => u !== undefined)
  const toggle = (id: number) => (current.includes(id) ? current.filter((n) => n !== id) : [...current, id])
  const canSet = (next: number[]) => checkAssign(me, current, next).ok

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Responsáveis"
        className="flex h-8 w-full max-w-64 items-center gap-2 rounded-full pr-2 pl-2.5 text-left text-[13px] text-ink outline-none transition-colors hover:bg-surface-sunken focus-visible:ring-4 focus-visible:ring-brand-100 disabled:pointer-events-none disabled:opacity-60 aria-expanded:bg-surface-sunken"
      >
        {selected.length === 0 ? (
          <span className="inline-flex items-center gap-2 text-ink-3">
            <AssigneeAvatars users={[]} className="size-5" /> Sem responsável
          </span>
        ) : (
          <>
            <AssigneeAvatars users={selected} avatarClassName="size-5" />
            <span className="truncate">{joinNames(selected.map((u) => (u.id === me.id ? "Você" : u.name.split(" ")[0])))}</span>
          </>
        )}
        <ChevronDown className="ml-auto size-4 shrink-0 text-ink-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {users.map((u) => (
          <DropdownMenuCheckboxItem
            key={u.id}
            checked={current.includes(u.id)}
            disabled={!canSet(toggle(u.id))}
            onCheckedChange={() => onChange(toggle(u.id))}
            // Continua aberto para marcar várias pessoas seguidas.
            onSelect={(e) => e.preventDefault()}
          >
            <UserAvatar user={u} size="sm" withTooltip={false} className="size-5 ring-0" />
            {u.name}
            {u.id === me.id && <span className="text-ink-3">(você)</span>}
          </DropdownMenuCheckboxItem>
        ))}
        {current.length > 0 && canSet([]) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange([])} className="text-ink-2">
              <span className="size-5 rounded-full border-[1.5px] border-dashed border-ink-4" />
              Deixar sem responsável
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Título editável no lugar: salva ao sair do campo ou com Enter; Esc desfaz. */
function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value)

  const commit = () => {
    const next = draft.replace(/\s+/g, " ").trim()
    if (!next) return setDraft(value)
    if (next !== value) onSave(next)
  }

  return (
    <textarea
      value={draft}
      rows={1}
      maxLength={200}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          e.currentTarget.blur()
        }
        if (e.key === "Escape") {
          setDraft(value)
        }
      }}
      aria-label="Título"
      className="-mx-2 block w-[calc(100%+1rem)] resize-none rounded-xl bg-transparent px-2 py-1 text-xl leading-snug font-semibold tracking-tight text-ink outline-none [field-sizing:content] hover:bg-surface-sunken focus:bg-surface-sunken"
    />
  )
}

function EditableDescription({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value)

  return (
    <Textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
      placeholder="Adicione detalhes, links, número do chamado…"
      maxLength={5000}
      className="-mx-2 min-h-16 w-[calc(100%+1rem)] resize-none bg-transparent px-2 hover:bg-surface-sunken"
    />
  )
}

/* ───────────────────────── apoio ───────────────────────── */

function Notice({
  tone,
  icon,
  title,
  children,
}: {
  tone: "danger" | "warning" | "neutral"
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-2xl px-4 py-3 text-[13px] leading-relaxed [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
        tone === "danger"
          ? "bg-danger-soft [&>svg]:text-danger"
          : tone === "warning"
            ? "bg-warning-soft [&>svg]:text-warning"
            : "bg-surface-sunken [&>svg]:text-ink-3"
      )}
    >
      {icon}
      <p className="text-ink-2">
        <span
          className={cn("font-semibold", tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-ink")}
        >
          {title}
        </span>{" "}
        ·{" "}
        {children}
      </p>
    </div>
  )
}

/** Liga um aviso temporário (ex.: "Salvo") que some sozinho depois de `ms`. */
function useFlash(ms: number): [boolean, () => void] {
  const [visible, setVisible] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const flash = () => {
    setVisible(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setVisible(false), ms)
  }
  return [visible, flash]
}

function SaveStatus({ pending, saved }: { pending: boolean; saved: boolean }) {
  if (pending) return <span className="ml-auto animate-pulse text-ink-3">Salvando…</span>
  if (saved)
    return (
      <span className="ml-auto inline-flex animate-pop-in items-center gap-1 text-success">
        <Check className="size-3.5" /> Salvo
      </span>
    )
  return null
}

function DrawerSkeleton() {
  return (
    <div className="space-y-6 px-7 pt-6" aria-busy aria-label="Carregando a tarefa">
      <SheetTitle className="sr-only">Carregando a tarefa</SheetTitle>
      <div className="h-3 w-32 animate-pulse rounded-full bg-hairline" />
      <div className="h-7 w-4/5 animate-pulse rounded-full bg-hairline" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-5 w-2/3 animate-pulse rounded-full bg-surface-sunken" />
        ))}
      </div>
      <div className="h-24 animate-pulse rounded-2xl bg-surface-sunken" />
    </div>
  )
}
