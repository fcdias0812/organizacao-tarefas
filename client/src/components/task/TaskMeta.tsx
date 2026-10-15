import { CalendarDays, UserRoundPlus } from "lucide-react"
import { cn } from "cn"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAppConfig } from "@/features/settings/appConfig"
import { formatDueLabel, formatLongDate, getDueState } from "@/lib/dates"
import { AVATAR_COLORS, initials, profileLabel, type CategoryKey, type TaskPriority, type User } from "@/lib/domain"

export function PriorityDot({
  priority,
  showLabel = false,
  className,
}: {
  priority: TaskPriority
  showLabel?: boolean
  className?: string
}) {
  const meta = useAppConfig().priority(priority)
  const dot = (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-ink-2", className)}
      aria-label={`Prioridade ${meta.label}`}
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
      {showLabel && meta.label}
    </span>
  )

  if (showLabel) return dot
  return (
    <Tooltip>
      <TooltipTrigger asChild>{dot}</TooltipTrigger>
      <TooltipContent>Prioridade {meta.label.toLowerCase()}</TooltipContent>
    </Tooltip>
  )
}

export function CategoryLabel({
  category,
  iconOnly = false,
  className,
}: {
  category: CategoryKey
  /** Só o ícone (card compacto); o nome aparece ao passar o mouse. */
  iconOnly?: boolean
  className?: string
}) {
  const { label, Icon } = useAppConfig().category(category)
  if (iconOnly)
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex shrink-0 text-ink-3", className)} aria-label={`Categoria ${label}`}>
            <Icon className="size-3.5" strokeWidth={2} />
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    )
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-ink-3", className)}>
      <Icon className="size-3.5" strokeWidth={2} />
      {label}
    </span>
  )
}

export function CategoryChip({ category, className }: { category: CategoryKey; className?: string }) {
  const { label, Icon } = useAppConfig().category(category)
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-xs font-medium text-ink-2",
        className
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </span>
  )
}

const dueStyles = {
  overdue: "bg-danger-soft text-danger",
  soon: "bg-warning-soft text-warning",
  normal: "text-ink-3",
}

export function DueChip({
  dueDate,
  muted = false,
  now,
}: {
  dueDate: string
  /** Em Concluído o prazo não chama atenção. */
  muted?: boolean
  now?: Date
}) {
  const { soonDays } = useAppConfig().settings
  const state = muted ? "normal" : getDueState(dueDate, now, soonDays)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex h-6 shrink-0 items-center gap-1 rounded-full text-xs font-medium whitespace-nowrap",
            state === "normal" ? "px-0" : "px-2",
            dueStyles[state]
          )}
        >
          <CalendarDays className="size-3.5" />
          {formatDueLabel(dueDate, now)}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {state === "overdue" ? "Venceu em " : "Prazo: "}
        {formatLongDate(dueDate)}
      </TooltipContent>
    </Tooltip>
  )
}

export function UserAvatar({
  user,
  size = "default",
  withTooltip = true,
  className,
}: {
  user: User
  size?: "sm" | "default" | "lg"
  withTooltip?: boolean
  className?: string
}) {
  const avatar = (
    <Avatar size={size} className={cn("ring-2 ring-surface", className)}>
      <AvatarFallback className={AVATAR_COLORS[user.avatarColor]}>{initials(user.name)}</AvatarFallback>
    </Avatar>
  )
  if (!withTooltip) return avatar
  return (
    <Tooltip>
      <TooltipTrigger asChild>{avatar}</TooltipTrigger>
      <TooltipContent>
        {user.name} · {user.jobTitle ?? profileLabel(user)}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Responsáveis de uma tarefa: fotos sobrepostas (até `max`) e "+N" para o resto.
 * Sem ninguém, mostra o círculo tracejado de "sem responsável".
 */
export function AssigneeAvatars({
  users,
  max = 3,
  className,
  avatarClassName,
}: {
  users: User[]
  max?: number
  className?: string
  /** Ex.: fotos menores dentro de um selo. */
  avatarClassName?: string
}) {
  if (users.length === 0) {
    return (
      <span
        className={cn("grid size-6 place-items-center rounded-full border-[1.5px] border-dashed border-ink-4 text-ink-3", className)}
        title="Sem responsável"
      >
        <UserRoundPlus className="size-3" />
      </span>
    )
  }
  const shown = users.length > max ? users.slice(0, max - 1) : users
  const hidden = users.slice(shown.length)
  return (
    <span className={cn("flex items-center -space-x-1.5", className)} aria-label={`Responsáveis: ${users.map((u) => u.name).join(", ")}`}>
      {shown.map((u) => (
        <UserAvatar key={u.id} user={u} size="sm" className={avatarClassName} />
      ))}
      {hidden.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="relative grid size-6 place-items-center rounded-full bg-surface-sunken text-[10px] font-semibold text-ink-2 ring-2 ring-surface tabular-nums">
              +{hidden.length}
            </span>
          </TooltipTrigger>
          <TooltipContent>{hidden.map((u) => u.name).join(", ")}</TooltipContent>
        </Tooltip>
      )}
    </span>
  )
}
