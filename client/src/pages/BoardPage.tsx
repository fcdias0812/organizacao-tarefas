import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { CalendarClock, Eye, Plus, RotateCw, WifiOff } from "lucide-react"
import { useSearchParams } from "react-router"
import { cn } from "cn"

import { COLUMN_WIDTH } from "@/components/board/BoardColumn"
import { TopBar } from "@/components/layout/TopBar"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { useMe } from "@/features/auth/useAuth"
import { BoardDnd } from "@/features/board/BoardDnd"
import { ArchivedSheet } from "@/features/board/ArchivedSheet"
import { DensityToggle } from "@/features/board/DensityToggle"
import { FilterBar } from "@/features/board/FilterBar"
import { useBoard } from "@/features/board/useBoardData"
import { filterTasks, useBoardFilters } from "@/features/board/useBoardFilters"
import { useCardDensity } from "@/features/board/useCardDensity"
import { QuickCreate } from "@/features/task/QuickCreate"
import { useAppConfig } from "@/features/settings/appConfig"
import { getDueState } from "@/lib/dates"
import { STATUS_ORDER, type TaskStatus } from "@/lib/domain"

// O painel da tarefa (com calendário) só é baixado quando um card é aberto.
const TaskDrawer = lazy(() => import("@/features/task/TaskDrawer").then((m) => ({ default: m.TaskDrawer })))

export function BoardPage() {
  const { data: me } = useMe()
  const board = useBoard()

  // A tarefa aberta fica na URL (?tarefa=12): dá para mandar o link e o "voltar" fecha o painel.
  const [searchParams, setSearchParams] = useSearchParams()
  const openTaskId = Number(searchParams.get("tarefa")) || null
  // Depois de aberto uma vez, o painel continua montado para animar a saída ao fechar.
  const [drawerLoaded, setDrawerLoaded] = useState(false)
  if (openTaskId !== null && !drawerLoaded) setDrawerLoaded(true)
  const openTask = (id: number) =>
    setSearchParams((params) => {
      params.set("tarefa", String(id))
      return params
    })
  const closeTask = () =>
    setSearchParams((params) => {
      params.delete("tarefa")
      return params
    })

  const filtersApi = useBoardFilters()
  const visibleIds = useMemo(
    () => filterTasks(board.tasks, filtersApi.filters, filtersApi.isActive),
    [board.tasks, filtersApi.filters, filtersApi.isActive]
  )

  const { density, setDensity } = useCardDensity()
  const [quickOpen, setQuickOpen] = useState(false)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const highlightTimer = useRef<number | undefined>(undefined)
  const searchRef = useRef<HTMLInputElement>(null)

  // Atalhos globais: N = nova tarefa, / = buscar. Ignorados ao digitar ou com janela aberta.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      const target = e.target as HTMLElement
      if (target.closest("input, textarea, select, [contenteditable=true]")) return
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return
      if (e.key === "n" || e.key === "N") {
        e.preventDefault()
        setQuickOpen(true)
      } else if (e.key === "/") {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <TopBar team={board.users} />

      <div className="space-y-4 px-4 pt-4 pb-4 sm:px-6 short:space-y-3 short:pt-1 short:pb-3">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="space-y-1">
            <p className="text-sm text-ink-3 first-letter:uppercase short:hidden">{todayLabel()}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink short:text-xl">
              {greeting()}, {me?.name.split(" ")[0]}
            </h1>
          </div>
          {!board.isPending && !board.error && <Highlights board={board} isManager={me?.role === "manager"} />}
          <Button className="ml-auto" onClick={() => setQuickOpen(true)} aria-keyshortcuts="N">
            <Plus /> Nova tarefa
            <Kbd className="ml-0.5 bg-white/20 text-white shadow-none">N</Kbd>
          </Button>
        </div>
        {me && (
          <FilterBar
            api={filtersApi}
            users={board.users}
            me={me}
            visibleCount={visibleIds?.size ?? board.tasks.length}
            searchRef={searchRef}
            trailing={
              <div className="flex items-center gap-1">
                <ArchivedSheet me={me} users={board.users} onOpenTask={openTask} />
                <DensityToggle value={density} onChange={setDensity} />
              </div>
            }
          />
        )}
      </div>

      <div className="min-h-0 flex-1">
        {board.error ? (
          <BoardError message={board.error.message} onRetry={board.refetch} />
        ) : board.isPending ? (
          <BoardSkeleton />
        ) : (
          me && (
            <BoardDnd
              tasks={board.tasks}
              users={board.users}
              me={me}
              onOpenTask={openTask}
              onAddTask={() => setQuickOpen(true)}
              visibleIds={visibleIds}
              highlightId={highlightId}
              compact={density === "compact"}
            />
          )
        )}
      </div>

      {me && (
        <QuickCreate
          open={quickOpen}
          onOpenChange={setQuickOpen}
          me={me}
          users={board.users}
          onCreated={(task, { open }) => {
            if (open) openTask(task.id)
            setHighlightId(task.id)
            window.clearTimeout(highlightTimer.current)
            highlightTimer.current = window.setTimeout(() => setHighlightId(null), 2500)
          }}
        />
      )}

      {me && (openTaskId !== null || drawerLoaded) && (
        <Suspense fallback={null}>
          <TaskDrawer taskId={openTaskId} me={me} users={board.users} onClose={closeTask} />
        </Suspense>
      )}
    </div>
  )
}

function Highlights({ board, isManager }: { board: ReturnType<typeof useBoard>; isManager: boolean }) {
  const { soonDays } = useAppConfig().settings
  const open = board.tasks.filter((t) => t.status !== "done")
  const overdue = open.filter((t) => t.dueDate && getDueState(t.dueDate, undefined, soonDays) === "overdue").length
  const inReview = board.columns.review.length

  return (
    <div className="flex flex-wrap items-center gap-2 pb-0.5">
      {overdue > 0 && (
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-danger-soft px-3 text-[13px] font-medium text-danger">
          <CalendarClock className="size-3.5" />
          {overdue === 1 ? "1 tarefa vencida" : `${overdue} tarefas vencidas`}
        </span>
      )}
      {inReview > 0 && (
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-50 px-3 text-[13px] font-medium text-brand-700">
          <Eye className="size-3.5" />
          {inReview === 1 ? "1 card" : `${inReview} cards`}{" "}
          {isManager ? "esperando sua revisão" : "em revisão"}
        </span>
      )}
      <span className="inline-flex h-8 items-center px-1 text-[13px] text-ink-3">{open.length} abertas no total</span>
    </div>
  )
}

function BoardSkeleton() {
  const counts: Record<TaskStatus, number> = { todo: 3, in_progress: 2, review: 2, done: 1, blocked: 1 }
  return (
    <div className="flex h-full gap-3 overflow-hidden px-4 pb-6 sm:gap-4 sm:px-6" aria-busy aria-label="Carregando o quadro">
      {STATUS_ORDER.map((status) => (
        <div key={status} className={cn(COLUMN_WIDTH, "flex flex-col gap-2 rounded-3xl bg-surface-sunken/80 p-3")}>
          <div className="mb-1 h-6 w-28 animate-pulse rounded-full bg-hairline" />
          {Array.from({ length: counts[status] }, (_, i) => (
            <div key={i} className="h-[112px] animate-pulse rounded-xl bg-surface shadow-card" />
          ))}
        </div>
      ))}
    </div>
  )
}

function BoardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid h-full place-items-center px-6 pb-16">
      <div className="max-w-sm space-y-4 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-danger-soft text-danger">
          <WifiOff className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="font-semibold text-ink">Não deu para carregar o quadro</p>
          <p className="text-sm text-ink-2">{message}</p>
        </div>
        <Button variant="outline" onClick={onRetry}>
          <RotateCw /> Tentar de novo
        </Button>
      </div>
    </div>
  )
}

function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return "Bom dia"
  if (h < 18) return "Boa tarde"
  return "Boa noite"
}

const todayFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" })
const todayLabel = () => todayFormat.format(new Date())
