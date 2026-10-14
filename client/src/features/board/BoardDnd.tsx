import { useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  closestCorners,
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Check, Hourglass, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { previewMove, type TaskStatus, type TaskSummaryDTO, type UserDTO } from "@tarefas/shared"
import { cn } from "cn"

import { BoardColumn, type DropState } from "@/components/board/BoardColumn"
import { ReasonDialog, type ReasonKind } from "@/components/board/ReasonDialog"
import { TaskCard } from "@/components/task/TaskCard"
import { Button } from "@/components/ui/button"
import { useAppConfig } from "@/features/settings/appConfig"
import { STATUS_ORDER, type TaskCardData } from "@/lib/domain"
import { toCardData } from "./useBoardData"
import { useMoveTask } from "./useMoveTask"

type Columns = Record<TaskStatus, number[]>

const COLUMN_PREFIX = "col:"
const columnId = (status: TaskStatus) => `${COLUMN_PREFIX}${status}`

function groupByStatus(tasks: TaskSummaryDTO[]): Columns {
  const columns: Columns = { todo: [], in_progress: [], review: [], done: [], blocked: [] }
  for (const t of [...tasks].sort((a, b) => a.position - b.position)) columns[t.status].push(t.id)
  return columns
}

function findStatus(id: UniqueIdentifier, columns: Columns): TaskStatus | undefined {
  if (typeof id === "string" && id.startsWith(COLUMN_PREFIX)) return id.slice(COLUMN_PREFIX.length) as TaskStatus
  return STATUS_ORDER.find((s) => columns[s].includes(Number(id)))
}

const dropAnimation: DropAnimation = {
  duration: 220,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
}

interface ReasonRequest {
  kind: ReasonKind
  task: TaskSummaryDTO
  status: TaskStatus
  index: number
}

interface BoardDndProps {
  tasks: TaskSummaryDTO[]
  users: UserDTO[]
  me: UserDTO
  onOpenTask: (id: number) => void
  onAddTask?: () => void
  /** Ids que passam nos filtros; null = sem filtro. */
  visibleIds?: Set<number> | null
  /** Card recém-criado, destacado por alguns segundos. */
  highlightId?: number | null
}

export function BoardDnd({ tasks, users, me, onOpenTask, onAddTask, visibleIds = null, highlightId = null }: BoardDndProps) {
  const [now] = useState(() => new Date())
  const config = useAppConfig()
  const { move } = useMoveTask(me.role)

  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const cardsById = useMemo(() => {
    const usersById = new Map(users.map((u) => [u.id, u]))
    return new Map(tasks.map((t) => [t.id, toCardData(t, usersById)]))
  }, [tasks, users])
  const baseColumns = useMemo(() => groupByStatus(tasks), [tasks])

  // Durante o arraste a ordem é local; ao soltar, o cache do servidor assume.
  const [dragColumns, setDragColumns] = useState<Columns | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null)
  const [rejectedId, setRejectedId] = useState<number | null>(null)
  const [reasonRequest, setReasonRequest] = useState<ReasonRequest | null>(null)
  const rejectTimer = useRef<number | undefined>(undefined)

  const columns = dragColumns ?? baseColumns
  const activeTask = activeId !== null ? tasksById.get(activeId) : undefined

  // Para onde o card ativo pode ir, segundo as regras compartilhadas com o servidor.
  const previews = useMemo(() => {
    if (!activeTask) return null
    return Object.fromEntries(
      STATUS_ORDER.map((to) => [
        to,
        previewMove({
          from: activeTask.status,
          to,
          actorRole: me.role,
          checklistDone: activeTask.checklistDone,
          checklistTotal: activeTask.checklistTotal,
        }, config.ruleOptions),
      ])
    ) as Record<TaskStatus, ReturnType<typeof previewMove>>
  }, [activeTask, me.role, config.ruleOptions])

  // Teclado: setas ← → pulam para a coluna vizinha; ↑ ↓ reordenam dentro dela.
  const columnsRef = useRef(columns)
  useLayoutEffect(() => {
    columnsRef.current = columns
  })
  const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
    if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") return sortableKeyboardCoordinates(event, args)
    event.preventDefault()
    const { over, active, droppableRects } = args.context
    const ref = over?.id ?? active?.id
    const current = ref !== undefined ? findStatus(ref, columnsRef.current) : undefined
    if (!current) return undefined
    const next = STATUS_ORDER[STATUS_ORDER.indexOf(current) + (event.code === "ArrowRight" ? 1 : -1)]
    const rect = next ? droppableRects.get(columnId(next)) : undefined
    return rect ? { x: rect.left + 8, y: rect.top + 52 } : undefined
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    // Enter fica livre para abrir o card; Espaço pega e solta.
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter", "Tab"] },
    })
  )

  function reset() {
    setActiveId(null)
    setOverStatus(null)
    setDragColumns(null)
  }

  function reject(taskId: number, message: string) {
    toast.error(message)
    setRejectedId(taskId)
    window.clearTimeout(rejectTimer.current)
    rejectTimer.current = window.setTimeout(() => setRejectedId(null), 450)
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(Number(active.id))
    setDragColumns(baseColumns)
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || !activeTask || !previews) return
    const target = findStatus(over.id, columns)
    const current = findStatus(active.id, columns)
    setOverStatus(target ?? null)
    if (!target || !current || target === current) return

    // Coluna recusada: o card não entra nela (a coluna apaga e explica o motivo)
    // e, se tinha passado por outra coluna no caminho, volta para a de origem.
    if (target !== activeTask.status && !previews[target].ok) {
      if (current !== activeTask.status) {
        const id = activeTask.id
        setDragColumns((prev) => {
          const cols = prev ?? baseColumns
          const origin = cols[activeTask.status].filter((x) => x !== id)
          origin.splice(baseColumns[activeTask.status].indexOf(id), 0, id)
          return { ...cols, [current]: cols[current].filter((x) => x !== id), [activeTask.status]: origin }
        })
      }
      return
    }

    setDragColumns((prev) => {
      const cols = prev ?? baseColumns
      const id = Number(active.id)
      const targetList = cols[target].filter((x) => x !== id)
      let index = targetList.length
      if (!String(over.id).startsWith(COLUMN_PREFIX)) {
        const overIndex = targetList.indexOf(Number(over.id))
        const activeTop = active.rect.current.translated?.top ?? 0
        const isBelow = activeTop > over.rect.top + over.rect.height / 2
        index = overIndex >= 0 ? overIndex + (isBelow ? 1 : 0) : targetList.length
      }
      targetList.splice(index, 0, id)
      return { ...cols, [current]: cols[current].filter((x) => x !== id), [target]: targetList }
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const task = activeTask
    const cols = dragColumns ?? baseColumns
    reset()
    if (!over || !task || !previews) return

    const id = task.id
    const target = findStatus(over.id, cols)
    const current = findStatus(active.id, cols)
    if (!target || !current) return

    // Soltou sobre uma coluna que não aceita o card.
    if (target !== current) {
      const preview = previews[target]
      if (!preview.ok) reject(id, preview.message)
      return
    }

    const list = cols[current]
    const oldIndex = list.indexOf(id)
    const newIndex = String(over.id).startsWith(COLUMN_PREFIX) ? oldIndex : list.indexOf(Number(over.id))
    const index = arrayMove(list, oldIndex, newIndex === -1 ? oldIndex : newIndex).indexOf(id)

    if (current === task.status) {
      if (index !== baseColumns[current].indexOf(id)) move({ task, status: current, index })
      return
    }

    const preview = previews[current]
    if (!preview.ok) return reject(id, preview.message)
    if (preview.needsReason) {
      setReasonRequest({ kind: preview.event === "blocked" ? "block" : "return", task, status: current, index })
      return
    }
    move({ task, status: current, index })
  }

  function dropStateFor(status: TaskStatus): { state: DropState; reason?: string } {
    if (!activeTask || !previews || status === activeTask.status) return { state: "idle" }
    const preview = previews[status]
    if (!preview.ok) return { state: "deny", reason: overStatus === status ? preview.message : undefined }
    return { state: overStatus === status ? "accept" : "idle" }
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Card "${tasksById.get(Number(active.id))?.title}" selecionado.`,
    onDragOver: ({ over }) => {
      const status = over ? findStatus(over.id, columns) : undefined
      return status ? `Sobre a coluna ${config.statusLabel(status)}.` : undefined
    },
    onDragEnd: ({ over }) => {
      const status = over ? findStatus(over.id, columns) : undefined
      return status ? `Card solto em ${config.statusLabel(status)}.` : "Card solto."
    },
    onDragCancel: () => "Movimento cancelado. O card voltou para o lugar.",
  }

  const reviewActions = (task: TaskSummaryDTO) =>
    me.role === "manager" ? (
      <>
        <Button size="xs" variant="success" onClick={() => move({ task, status: "done", index: 0 })}>
          <Check /> Aprovar
        </Button>
        <Button
          size="xs"
          variant="warning"
          onClick={() => setReasonRequest({ kind: "return", task, status: "in_progress", index: 0 })}
        >
          <Undo2 /> Devolver
        </Button>
      </>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-1 text-xs text-ink-3">
        <Hourglass className="size-3.5" /> Aguardando o gestor
      </span>
    )

  const activeCard = activeId !== null ? cardsById.get(activeId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={reset}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Para mover um card, pressione espaço ou Enter. Use as setas para escolher o lugar e pressione espaço ou Enter para soltar. Esc cancela.",
        },
      }}
    >
      <div
        className={cn(
          "scroll-soft flex h-full snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:gap-4 sm:px-6 md:snap-none",
          activeId !== null && "snap-none"
        )}
      >
        {STATUS_ORDER.map((status) => {
          const { state, reason } = dropStateFor(status)
          // Com filtro, só os cards que passam (o card em arraste sempre aparece).
          const ids = visibleIds ? columns[status].filter((id) => visibleIds.has(id) || id === activeId) : columns[status]
          return (
            <DroppableColumn
              key={status}
              status={status}
              count={ids.length}
              dropState={state}
              denyReason={reason}
              filtered={visibleIds !== null}
              onAdd={status === "todo" ? onAddTask : undefined}
              className={cn("snap-start", status === "blocked" && "md:ml-3")}
            >
              {ids.length > 0 && (
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  {ids.map((id) => {
                    const card = cardsById.get(id)
                    const task = tasksById.get(id)
                    if (!card || !task) return null
                    return (
                      <SortableTaskCard
                        key={id}
                        card={card}
                        now={now}
                        rejected={rejectedId === id}
                        highlighted={highlightId === id}
                        actions={task.status === "review" && status === "review" ? reviewActions(task) : undefined}
                        onOpen={() => onOpenTask(id)}
                      />
                    )
                  })}
                </SortableContext>
              )}
            </DroppableColumn>
          )
        })}
        <div className="w-px shrink-0" />
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeCard ? <TaskCard task={activeCard} now={now} lifted /> : null}
      </DragOverlay>

      <ReasonDialog
        kind={reasonRequest?.kind ?? null}
        taskTitle={reasonRequest?.task.title}
        onCancel={() => setReasonRequest(null)}
        onConfirm={(reason) => {
          if (!reasonRequest) return
          const { task, status, index } = reasonRequest
          setReasonRequest(null)
          move({ task, status, index, reason })
        }}
      />
    </DndContext>
  )
}

function DroppableColumn(props: React.ComponentProps<typeof BoardColumn>) {
  const { setNodeRef } = useDroppable({ id: columnId(props.status) })
  return <BoardColumn {...props} ref={setNodeRef} />
}

function SortableTaskCard({
  card,
  now,
  rejected,
  actions,
  onOpen,
  highlighted,
}: {
  card: TaskCardData
  now: Date
  rejected: boolean
  highlighted: boolean
  actions?: React.ReactNode
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    attributes: { roleDescription: "card arrastável" },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "rounded-xl outline-none focus-visible:shadow-[0_0_0_2px_var(--brand-300),0_0_0_6px_var(--brand-100)]",
        isDragging && "border-[1.5px] border-dashed border-brand-300 bg-brand-50/70"
      )}
      aria-label={card.title}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) {
          e.preventDefault()
          onOpen()
          return
        }
        listeners?.onKeyDown?.(e)
      }}
    >
      <TaskCard
        task={card}
        now={now}
        rejected={rejected}
        actions={actions}
        role={undefined}
        tabIndex={-1}
        className={cn(
          "cursor-grab active:cursor-grabbing",
          isDragging && "invisible",
          highlighted && "animate-pop-in shadow-[0_0_0_2px_var(--brand-300),0_0_0_6px_var(--brand-100)]"
        )}
      />
    </div>
  )
}
