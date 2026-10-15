import { useState } from "react"
import {
  Archive,
  ArchiveRestore,
  Ban,
  Check,
  CirclePlus,
  MessageSquare,
  Pencil,
  RotateCcw,
  Send,
  Undo2,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import type { CommentDTO, TaskDetailDTO, TaskEventDTO, TaskEventType, UserDTO } from "@tarefas/shared"
import { cn } from "cn"

import { StatusIcon } from "@/components/task/StatusIcon"
import { UserAvatar } from "@/components/task/TaskMeta"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAppConfig } from "@/features/settings/appConfig"
import { formatFullDateTime, formatRelative } from "@/lib/dates"
import { useComments } from "./useTaskDetail"

const FIELD_LABELS: Record<string, string> = {
  title: "o título",
  description: "a descrição",
  priority: "a prioridade",
  dueDate: "o prazo",
  category: "a categoria",
}

const EVENT_STYLE: Partial<Record<TaskEventType, { icon: LucideIcon; className: string }>> = {
  created: { icon: CirclePlus, className: "bg-brand-50 text-brand-600" },
  sent_to_review: { icon: Send, className: "bg-brand-50 text-brand-600" },
  approved: { icon: Check, className: "bg-success-soft text-success" },
  returned: { icon: Undo2, className: "bg-warning-soft text-warning" },
  blocked: { icon: Ban, className: "bg-danger-soft text-danger" },
  reopened: { icon: RotateCcw, className: "bg-brand-50 text-brand-600" },
  assigned: { icon: UserRound, className: "bg-surface-sunken text-ink-2" },
  updated: { icon: Pencil, className: "bg-surface-sunken text-ink-2" },
  archived: { icon: Archive, className: "bg-surface-sunken text-ink-3" },
  restored: { icon: ArchiveRestore, className: "bg-brand-50 text-brand-600" },
}

function joinList(items: string[]) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`
}

/** Id único (registros antigos), lista de ids (novos) ou nada → lista de ids. */
function asIds(value: unknown): number[] {
  if (Array.isArray(value)) return value.filter((v): v is number => typeof v === "number")
  return typeof value === "number" ? [value] : []
}

function describe(
  event: TaskEventDTO,
  usersById: Map<number, UserDTO>,
  label: (s: NonNullable<TaskEventDTO["toStatus"]>) => string
): React.ReactNode {
  const to = event.toStatus ? label(event.toStatus) : ""
  const from = event.fromStatus ? label(event.fromStatus) : ""
  const names = (ids: number[]) => joinList(ids.map((id) => usersById.get(id)?.name.split(" ")[0] ?? "alguém"))

  switch (event.type) {
    case "created": {
      // Registros antigos: { assigneeId }; novos: { assigneeIds }.
      const ids = asIds(event.detail?.assigneeIds ?? event.detail?.assigneeId)
      if (ids.length === 0 || (ids.length === 1 && ids[0] === event.actorId)) return "criou a tarefa"
      return <>criou a tarefa e atribuiu a {names(ids)}</>
    }
    case "moved":
      return (
        <>
          moveu de {from} para <span className="font-medium text-ink">{to}</span>
        </>
      )
    case "sent_to_review":
      return <>enviou para {label("review")}</>
    case "approved":
      return "aprovou e concluiu"
    case "returned":
      return <>devolveu para {label("in_progress")}</>
    case "blocked":
      return "bloqueou a tarefa"
    case "unblocked":
      return <>desbloqueou e moveu para {to}</>
    case "reopened":
      return <>reabriu em {to}</>
    case "assigned": {
      // Registros antigos guardam um id (ou null); novos, a lista inteira antes e depois.
      const from = asIds(event.detail?.from)
      const to = asIds(event.detail?.to)
      const added = to.filter((id) => !from.includes(id))
      const removed = from.filter((id) => !to.includes(id))
      if (to.length === 0) return from.length > 1 ? "removeu todos os responsáveis" : "removeu o responsável"
      if (removed.length === 0 && added.length === 1 && added[0] === event.actorId) return "entrou como responsável"
      if (added.length === 0 && removed.length === 1 && removed[0] === event.actorId) return "saiu da tarefa"
      const parts = [added.length ? `incluiu ${names(added)}` : "", removed.length ? `tirou ${names(removed)}` : ""]
      return parts.filter(Boolean).join(" e ")
    }
    case "updated": {
      const fields = Array.isArray(event.detail?.fields) ? (event.detail.fields as string[]) : []
      return `alterou ${joinList(fields.map((f) => FIELD_LABELS[f] ?? f))}`
    }
    case "archived":
      return "arquivou a tarefa"
    case "restored":
      return "restaurou a tarefa para o quadro"
  }
}

type ActivityItem = { kind: "event"; at: string; event: TaskEventDTO } | { kind: "comment"; at: string; comment: CommentDTO }

/**
 * Atividade da tarefa: movimentações (quem criou, moveu, devolveu, bloqueou)
 * e comentários de acompanhamento, na mesma linha do tempo.
 */
export function TaskActivity({ task, users, me }: { task: TaskDetailDTO; users: UserDTO[]; me: UserDTO }) {
  const [now] = useState(() => new Date())
  const { statusLabel } = useAppConfig()
  const usersById = new Map(users.map((u) => [u.id, u]))

  const items: ActivityItem[] = [
    ...task.events.map((event) => ({ kind: "event" as const, at: event.createdAt, event })),
    ...task.comments.map((comment) => ({ kind: "comment" as const, at: comment.createdAt, comment })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  return (
    <div className="space-y-5">
      <ol className="relative space-y-4 before:absolute before:top-3 before:bottom-3 before:left-[11px] before:w-px before:bg-hairline">
        {items.map((item) =>
          item.kind === "event" ? (
            <EventItem key={`e${item.event.id}`} event={item.event} usersById={usersById} statusLabel={statusLabel} now={now} />
          ) : (
            <CommentItem
              key={`c${item.comment.id}`}
              taskId={task.id}
              comment={item.comment}
              author={usersById.get(item.comment.authorId)}
              me={me}
              now={now}
            />
          )
        )}
      </ol>
      <CommentComposer taskId={task.id} me={me} />
    </div>
  )
}

function When({ iso, now }: { iso: string; now: Date }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={iso} className="ml-1.5 text-xs whitespace-nowrap text-ink-3">
          {formatRelative(iso, now)}
        </time>
      </TooltipTrigger>
      <TooltipContent>{formatFullDateTime(iso)}</TooltipContent>
    </Tooltip>
  )
}

function Badge({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return (
    <span className={cn("absolute -right-1.5 -bottom-1 grid size-4 place-items-center rounded-full ring-2 ring-surface", className)}>
      <Icon className="size-2.5" strokeWidth={2.5} />
    </span>
  )
}

function EventItem({
  event,
  usersById,
  statusLabel,
  now,
}: {
  event: TaskEventDTO
  usersById: Map<number, UserDTO>
  statusLabel: (s: NonNullable<TaskEventDTO["toStatus"]>) => string
  now: Date
}) {
  const actor = usersById.get(event.actorId)
  const style = EVENT_STYLE[event.type]
  return (
    <li className="relative flex gap-3">
      <span className="relative">
        {actor ? <UserAvatar user={actor} size="sm" withTooltip={false} /> : <span className="block size-6 rounded-full bg-surface-sunken" />}
        {style ? (
          <Badge icon={style.icon} className={style.className} />
        ) : event.toStatus ? (
          <span className="absolute -right-1.5 -bottom-1 rounded-full bg-surface ring-2 ring-surface">
            <StatusIcon status={event.toStatus} className="size-3.5" />
          </span>
        ) : null}
      </span>
      <div className="min-w-0 flex-1 pt-0.5 text-[13px] leading-relaxed">
        <p className="text-ink-2">
          <span className="font-semibold text-ink">{actor?.name.split(" ")[0] ?? "Alguém"}</span>{" "}
          {describe(event, usersById, statusLabel)}
          <When iso={event.createdAt} now={now} />
        </p>
        {event.reason && (
          <p
            className={cn(
              "mt-1.5 rounded-xl px-3 py-2 text-ink-2",
              event.type === "blocked" ? "bg-danger-soft" : event.type === "returned" ? "bg-warning-soft" : "bg-surface-sunken"
            )}
          >
            “{event.reason}”
          </p>
        )}
      </div>
    </li>
  )
}

function CommentItem({
  taskId,
  comment,
  author,
  me,
  now,
}: {
  taskId: number
  comment: CommentDTO
  author?: UserDTO
  me: UserDTO
  now: Date
}) {
  const { edit, remove } = useComments(taskId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const mine = comment.authorId === me.id
  const canDelete = mine || me.isAdmin
  const edited = comment.updatedAt !== comment.createdAt

  const save = () => {
    const body = draft.trim()
    if (!body) return
    if (body === comment.body) return setEditing(false)
    edit.mutate({ id: comment.id, body }, { onSuccess: () => setEditing(false) })
  }

  return (
    <li className="group/comment relative flex gap-3">
      <span className="relative">
        {author ? <UserAvatar user={author} size="sm" withTooltip={false} /> : <span className="block size-6 rounded-full bg-surface-sunken" />}
        <Badge icon={MessageSquare} className="bg-brand-50 text-brand-600" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5 text-[13px] leading-relaxed">
        <p className="flex items-center text-ink-2">
          <span className="font-semibold text-ink">{author?.name.split(" ")[0] ?? "Alguém"}</span>
          <span className="ml-1">comentou</span>
          <When iso={comment.createdAt} now={now} />
          {edited && <span className="ml-1.5 text-xs text-ink-3">(editado)</span>}
          {!editing && (mine || canDelete) && (
            <span className="ml-auto flex gap-0.5 opacity-0 transition-opacity group-hover/comment:opacity-100 focus-within:opacity-100">
              {mine && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(comment.body)
                    setEditing(true)
                  }}
                  className="rounded-full px-2 py-0.5 text-xs font-medium text-ink-3 hover:bg-surface-sunken hover:text-ink"
                >
                  Editar
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => remove.mutate(comment.id)}
                  className="rounded-full px-2 py-0.5 text-xs font-medium text-ink-3 hover:bg-danger-soft hover:text-danger"
                >
                  Excluir
                </button>
              )}
            </span>
          )}
        </p>
        {editing ? (
          <div className="mt-1.5 space-y-2">
            <Textarea
              autoFocus
              value={draft}
              maxLength={2000}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save()
                if (e.key === "Escape") {
                  e.stopPropagation()
                  setEditing(false)
                }
              }}
              className="min-h-14 resize-none bg-surface"
            />
            <div className="flex justify-end gap-2">
              <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button size="xs" onClick={save} disabled={!draft.trim() || edit.isPending}>
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 rounded-2xl rounded-tl-md bg-surface-sunken px-3.5 py-2.5 whitespace-pre-wrap text-ink">
            {comment.body}
          </p>
        )}
      </div>
    </li>
  )
}

function CommentComposer({ taskId, me }: { taskId: number; me: UserDTO }) {
  const { add } = useComments(taskId)
  const [body, setBody] = useState("")
  const [focused, setFocused] = useState(false)

  const send = () => {
    const text = body.trim()
    if (!text || add.isPending) return
    add.mutate(text, { onSuccess: () => setBody("") })
  }

  return (
    <div className="flex gap-3">
      <UserAvatar user={me} size="sm" withTooltip={false} className="mt-1.5" />
      <div className="min-w-0 flex-1 space-y-2">
        <Textarea
          value={body}
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="Escreva um comentário de acompanhamento…"
          aria-label="Novo comentário"
          className={cn("resize-none transition-[min-height]", focused || body ? "min-h-20" : "min-h-10")}
        />
        {(focused || body) && (
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-xs text-ink-3">
              <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> envia
            </span>
            <Button
              size="sm"
              disabled={!body.trim() || add.isPending}
              // onMouseDown evita perder o clique quando o campo perde o foco.
              onMouseDown={(e) => e.preventDefault()}
              onClick={send}
            >
              <Send /> Comentar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
