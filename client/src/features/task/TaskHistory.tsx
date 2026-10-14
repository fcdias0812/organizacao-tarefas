import { useState } from "react"
import { Ban, Check, CirclePlus, Pencil, RotateCcw, Send, Undo2, UserRound, type LucideIcon } from "lucide-react"
import type { TaskEventDTO, TaskEventType, UserDTO } from "@tarefas/shared"
import { cn } from "cn"

import { StatusIcon } from "@/components/task/StatusIcon"
import { UserAvatar } from "@/components/task/TaskMeta"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatFullDateTime, formatRelative } from "@/lib/dates"
import { STATUS_META } from "@/lib/domain"

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
}

function joinList(items: string[]) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`
}

function describe(event: TaskEventDTO, actorId: number, usersById: Map<number, UserDTO>): React.ReactNode {
  const to = event.toStatus ? STATUS_META[event.toStatus].label : ""
  const from = event.fromStatus ? STATUS_META[event.fromStatus].label : ""
  const name = (id: unknown) => (typeof id === "number" ? usersById.get(id)?.name.split(" ")[0] : undefined)

  switch (event.type) {
    case "created": {
      const assignee = event.detail?.assigneeId
      if (typeof assignee === "number" && assignee !== actorId) return <>criou a tarefa e atribuiu a {name(assignee)}</>
      return "criou a tarefa"
    }
    case "moved":
      return (
        <>
          moveu de {from} para <span className="font-medium text-ink">{to}</span>
        </>
      )
    case "sent_to_review":
      return "enviou para Revisão"
    case "approved":
      return "aprovou e concluiu"
    case "returned":
      return "devolveu para Em andamento"
    case "blocked":
      return "bloqueou a tarefa"
    case "unblocked":
      return <>desbloqueou e moveu para {to}</>
    case "reopened":
      return <>reabriu em {to}</>
    case "assigned": {
      const target = event.detail?.to
      if (target === null) return "removeu o responsável"
      if (target === actorId) return "assumiu a tarefa"
      return <>atribuiu a {name(target)}</>
    }
    case "updated": {
      const fields = Array.isArray(event.detail?.fields) ? (event.detail.fields as string[]) : []
      return `alterou ${joinList(fields.map((f) => FIELD_LABELS[f] ?? f))}`
    }
  }
}

/** Linha do tempo do card: quem criou, moveu, devolveu, bloqueou e quando. */
export function TaskHistory({ events, users }: { events: TaskEventDTO[]; users: UserDTO[] }) {
  const [now] = useState(() => new Date())
  const usersById = new Map(users.map((u) => [u.id, u]))

  return (
    <ol className="relative space-y-4 before:absolute before:top-3 before:bottom-3 before:left-[11px] before:w-px before:bg-hairline">
      {events.map((event) => {
        const actor = usersById.get(event.actorId)
        const style = EVENT_STYLE[event.type]
        const Icon = style?.icon
        return (
          <li key={event.id} className="relative flex gap-3">
            <span className="relative">
              {actor ? (
                <UserAvatar user={actor} size="sm" withTooltip={false} />
              ) : (
                <span className="block size-6 rounded-full bg-surface-sunken" />
              )}
              {Icon ? (
                <span
                  className={cn(
                    "absolute -right-1.5 -bottom-1 grid size-4 place-items-center rounded-full ring-2 ring-surface",
                    style.className
                  )}
                >
                  <Icon className="size-2.5" strokeWidth={2.5} />
                </span>
              ) : event.toStatus ? (
                <span className="absolute -right-1.5 -bottom-1 rounded-full bg-surface ring-2 ring-surface">
                  <StatusIcon status={event.toStatus} className="size-3.5" />
                </span>
              ) : null}
            </span>
            <div className="min-w-0 flex-1 pt-0.5 text-[13px] leading-relaxed">
              <p className="text-ink-2">
                <span className="font-semibold text-ink">{actor?.name.split(" ")[0] ?? "Alguém"}</span>{" "}
                {describe(event, event.actorId, usersById)}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <time dateTime={event.createdAt} className="ml-1.5 text-xs whitespace-nowrap text-ink-3">
                      {formatRelative(event.createdAt, now)}
                    </time>
                  </TooltipTrigger>
                  <TooltipContent>{formatFullDateTime(event.createdAt)}</TooltipContent>
                </Tooltip>
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
      })}
    </ol>
  )
}
