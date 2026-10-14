import { CalendarDays } from "lucide-react"
import { cn } from "cn"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDueLabel, formatLongDate, getDueState } from "@/lib/dates"
import {
  AVATAR_COLORS,
  CATEGORY_META,
  initials,
  PRIORITY_META,
  ROLE_LABEL,
  type CategoryKey,
  type TaskPriority,
  type User,
} from "@/lib/domain"

export function PriorityDot({
  priority,
  showLabel = false,
  className,
}: {
  priority: TaskPriority
  showLabel?: boolean
  className?: string
}) {
  const meta = PRIORITY_META[priority]
  const dot = (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-ink-2", className)}
      aria-label={`Prioridade ${meta.label}`}
    >
      <span className={cn("size-2 rounded-full", meta.dotClass)} />
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

export function CategoryLabel({ category, className }: { category: CategoryKey; className?: string }) {
  const { label, icon: Icon } = CATEGORY_META[category]
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-ink-3", className)}>
      <Icon className="size-3.5" strokeWidth={2} />
      {label}
    </span>
  )
}

export function CategoryChip({ category, className }: { category: CategoryKey; className?: string }) {
  const { label, icon: Icon } = CATEGORY_META[category]
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
  const state = muted ? "normal" : getDueState(dueDate, now)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded-full text-xs font-medium",
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
        {user.name} · {user.jobTitle ?? ROLE_LABEL[user.role]}
      </TooltipContent>
    </Tooltip>
  )
}
