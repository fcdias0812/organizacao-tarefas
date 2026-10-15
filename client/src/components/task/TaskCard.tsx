import { Ban, ListChecks, MessageSquare, Undo2 } from "lucide-react"
import { cn } from "cn"

import { AssigneeAvatars, CategoryLabel, DueChip, PriorityDot } from "@/components/task/TaskMeta"
import type { TaskCardData } from "@/lib/domain"

interface TaskCardProps extends React.ComponentProps<"div"> {
  task: TaskCardData
  /** Cópia flutuante que acompanha o cursor durante o arraste. */
  lifted?: boolean
  /** Recusado ao soltar (ex.: checklist incompleto): treme e volta. */
  rejected?: boolean
  now?: Date
  /** Ações rápidas no rodapé do card (ex.: Aprovar / Devolver na Revisão). */
  actions?: React.ReactNode
  /** Versão baixa para ver mais cards de uma vez: a categoria vira ícone no rodapé. */
  compact?: boolean
}

export function TaskCard({ task, lifted, rejected, now, actions, compact = false, className, ...props }: TaskCardProps) {
  const isDone = task.status === "done"
  const checklistComplete = task.checklistTotal > 0 && task.checklistDone === task.checklistTotal

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group/card relative flex flex-col rounded-xl bg-surface text-left shadow-card outline-none",
        compact ? "gap-2 p-2.5" : "gap-3 p-3.5",
        "transition-[box-shadow,transform] duration-200 ease-(--ease-out-soft)",
        "hover:-translate-y-px hover:shadow-card-hover focus-visible:shadow-[0_0_0_2px_var(--brand-300),0_0_0_6px_var(--brand-100)]",
        lifted && "rotate-[2deg] scale-[1.03] cursor-grabbing shadow-lift ring-1 ring-brand-200 hover:translate-y-0 hover:shadow-lift",
        rejected && "animate-shake shadow-[0_0_0_2px_var(--danger-soft),0_0_0_1px_var(--danger)]",
        className
      )}
      {...props}
    >
      {!compact && (
        <div className="flex items-center justify-between gap-2">
          <CategoryLabel category={task.category} />
          <PriorityDot priority={task.priority} />
        </div>
      )}

      <div className="flex items-start gap-2">
        <p
          className={cn(
            "line-clamp-2 flex-1 leading-snug font-medium text-ink",
            compact ? "text-[13px]" : "text-[14px]",
            isDone && "text-ink-3"
          )}
        >
          {task.title}
        </p>
        {compact && <PriorityDot priority={task.priority} className="mt-1.5" />}
      </div>

      {task.status === "blocked" && task.blockedReason && (
        <ReasonNote tone="danger" icon={<Ban className="size-3.5" />} label="Bloqueado" compact={compact}>
          {task.blockedReason}
        </ReasonNote>
      )}

      {task.status !== "blocked" && !isDone && task.lastReturnReason && (
        <ReasonNote tone="warning" icon={<Undo2 className="size-3.5" />} label="Devolvido" compact={compact}>
          {task.lastReturnReason}
        </ReasonNote>
      )}

      <div className={cn("flex items-center", compact ? "gap-2.5" : "gap-3")}>
        {compact && <CategoryLabel category={task.category} iconOnly />}
        {task.dueDate && <DueChip dueDate={task.dueDate} muted={isDone} now={now} />}

        {task.checklistTotal > 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
              checklistComplete ? "text-success" : "text-ink-3"
            )}
            aria-label={`Checklist ${task.checklistDone} de ${task.checklistTotal}`}
          >
            <ListChecks className="size-3.5" />
            {task.checklistDone}/{task.checklistTotal}
          </span>
        )}

        {!!task.commentCount && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-3 tabular-nums"
            aria-label={task.commentCount === 1 ? "1 comentário" : `${task.commentCount} comentários`}
          >
            <MessageSquare className="size-3.5" />
            {task.commentCount}
          </span>
        )}

        <AssigneeAvatars users={task.assignees} max={compact ? 2 : 3} className="ml-auto" />
      </div>

      {actions && (
        <div
          className={cn("-mx-1 -mb-1 flex items-center gap-1.5 border-t border-hairline", compact ? "pt-2" : "pt-2.5")}
          // Botões dentro do card não iniciam arraste nem abrem o card.
          onPointerDown={stop}
          onMouseDown={stop}
          onTouchStart={stop}
          onKeyDown={stop}
          onClick={stop}
        >
          {actions}
        </div>
      )}
    </div>
  )
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation()

function ReasonNote({
  tone,
  icon,
  label,
  compact,
  children,
}: {
  tone: "danger" | "warning"
  icon: React.ReactNode
  label: string
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg px-2.5 text-xs leading-relaxed",
        compact ? "py-1.5" : "py-2",
        tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"
      )}
    >
      <span className="mt-px shrink-0">{icon}</span>
      <p className={compact ? "line-clamp-1" : "line-clamp-2"}>
        <span className="font-semibold">{label}:</span>{" "}
        <span className="text-ink-2">{children}</span>
      </p>
    </div>
  )
}

/** Espaço reservado onde o card vai cair durante o arraste. */
export function TaskCardPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-[104px] rounded-xl border-[1.5px] border-dashed border-brand-300 bg-brand-50/70",
        className
      )}
    />
  )
}
