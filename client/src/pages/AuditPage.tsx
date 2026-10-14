import { useEffect, useMemo, useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ExternalLink,
  KeyRound,
  LayoutList,
  ListChecks,
  MessageSquare,
  Search,
  Settings,
  Tags,
  TerminalSquare,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"
import { Link } from "react-router"
import type { AuditArea, AuditEntryDTO, UserDTO } from "@tarefas/shared"
import { cn } from "cn"

import { TopBar } from "@/components/layout/TopBar"
import { UserAvatar } from "@/components/task/TaskMeta"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useBoard } from "@/features/board/useBoardData"
import { api } from "@/lib/api"
import { formatFullDateTime } from "@/lib/dates"
import { queryKeys } from "@/lib/queryClient"

const AREAS: Record<AuditArea, { label: string; icon: LucideIcon }> = {
  tasks: { label: "Tarefas", icon: LayoutList },
  checklist: { label: "Checklist", icon: ListChecks },
  comments: { label: "Comentários", icon: MessageSquare },
  access: { label: "Acesso", icon: KeyRound },
  users: { label: "Usuários", icon: Users },
  categories: { label: "Categorias", icon: Tags },
  settings: { label: "Configurações", icon: Settings },
}

const PAGE_SIZE = 100
const ALL = "todas"

interface Filters {
  /** AAAA-MM-DD (data local). */
  from: string
  to: string
  actor: string
  area: string
  query: string
  order: "desc" | "asc"
}

const EMPTY: Filters = { from: "", to: "", actor: ALL, area: ALL, query: "", order: "desc" }

/** Início/fim do dia local em ISO, para comparar com os horários gravados (UTC). */
function dayBound(date: string, end: boolean) {
  const [y, m, d] = date.split("-").map(Number)
  return (end ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d)).toISOString()
}

function toParams(filters: Filters, offset: number) {
  const params = new URLSearchParams({ order: filters.order, offset: String(offset), limit: String(PAGE_SIZE) })
  if (filters.from) params.set("since", dayBound(filters.from, false))
  if (filters.to) params.set("until", dayBound(filters.to, true))
  if (filters.actor !== ALL) params.set("actor", filters.actor)
  if (filters.area !== ALL) params.set("area", filters.area)
  if (filters.query.trim()) params.set("q", filters.query.trim())
  return params
}

/** Auditoria: tudo o que foi feito no sistema, por quem e quando. Todos podem ver. */
export function AuditPage() {
  const board = useBoard()
  const [filters, setFilters] = useState<Filters>(EMPTY)
  const [search, setSearch] = useState("")

  // A busca espera a pessoa parar de digitar.
  useEffect(() => {
    const timer = window.setTimeout(() => setFilters((f) => (f.query === search ? f : { ...f, query: search })), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const audit = useInfiniteQuery({
    queryKey: [...queryKeys.audit, filters],
    queryFn: ({ pageParam }) =>
      api<{ entries: AuditEntryDTO[]; hasMore: boolean }>("GET", `/audit?${toParams(filters, pageParam)}`),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length * PAGE_SIZE : undefined),
    staleTime: 0,
  })
  const entries = useMemo(() => audit.data?.pages.flatMap((p) => p.entries) ?? [], [audit.data])

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }))
  const isFiltered = filters.from || filters.to || filters.actor !== ALL || filters.area !== ALL || filters.query
  const usersById = new Map(board.users.map((u) => [u.id, u]))
  // Tarefas excluídas de vez não abrem mais (vale para todas as linhas delas).
  const deletedTaskIds = new Set(entries.filter((e) => e.action === "task.deleted").map((e) => e.taskId))

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="sticky top-0 z-30 bg-canvas/85 backdrop-blur-md">
        <TopBar team={board.users} />
      </div>

      <main className="mx-auto max-w-[1200px] space-y-5 px-4 pb-24 sm:px-6">
        <div className="space-y-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-medium text-ink-3 transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <ArrowLeft className="size-4" /> Voltar ao quadro
          </Link>
          <div className="space-y-1 px-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Auditoria</h1>
            <p className="text-sm text-ink-2">Tudo o que foi feito no sistema: quem fez, o quê e quando.</p>
          </div>
        </div>

        {/* Filtros: período, pessoa, área e busca. */}
        <div className="flex flex-wrap items-end gap-2 rounded-3xl bg-surface p-4 shadow-card">
          <FilterField label="De">
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => set({ from: e.target.value })}
              className={fieldClass}
              aria-label="Data inicial"
            />
          </FilterField>
          <FilterField label="Até">
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => set({ to: e.target.value })}
              className={fieldClass}
              aria-label="Data final"
            />
          </FilterField>
          <FilterField label="Pessoa">
            <Select value={filters.actor} onValueChange={(actor) => set({ actor })}>
              <SelectTrigger size="sm" className="h-9 w-48" aria-label="Pessoa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectItem value={ALL}>Todas as pessoas</SelectItem>
                {board.users.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name}
                  </SelectItem>
                ))}
                <SelectItem value="system">Sistema (linha de comando)</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Área">
            <Select value={filters.area} onValueChange={(area) => set({ area })}>
              <SelectTrigger size="sm" className="h-9 w-44" aria-label="Área">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectItem value={ALL}>Todas as áreas</SelectItem>
                {(Object.keys(AREAS) as AuditArea[]).map((area) => (
                  <SelectItem key={area} value={area}>
                    {AREAS[area].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Buscar" className="min-w-48 flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
              <input
                type="search"
                value={search}
                maxLength={100}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tarefa, item, nome…"
                className={cn(fieldClass, "w-full pl-9")}
                aria-label="Buscar na auditoria"
              />
            </div>
          </FilterField>
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setSearch("")
                setFilters({ ...EMPTY, order: filters.order })
              }}
            >
              <X /> Limpar filtros
            </Button>
          )}
        </div>

        <div className="overflow-hidden rounded-3xl bg-surface shadow-card">
          <div className="scroll-soft overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-hairline text-xs text-ink-3">
                <tr>
                  <th className="w-44 px-5 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() => set({ order: filters.order === "desc" ? "asc" : "desc" })}
                      className="inline-flex items-center gap-1 rounded-md hover:text-ink"
                      aria-label={`Data e hora, ${filters.order === "desc" ? "mais recentes primeiro" : "mais antigas primeiro"}`}
                    >
                      Data e hora
                      {filters.order === "desc" ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
                    </button>
                  </th>
                  <th className="w-48 px-3 py-3 font-medium">Pessoa</th>
                  <th className="w-36 px-3 py-3 font-medium">Área</th>
                  <th className="px-3 py-3 pr-5 font-medium">O que foi feito</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <AuditRow
                    key={entry.id}
                    entry={entry}
                    user={entry.actorId ? usersById.get(entry.actorId) : undefined}
                    canOpen={entry.taskId !== null && !deletedTaskIds.has(entry.taskId)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {audit.isPending ? (
            <p className="px-5 py-10 text-center text-sm text-ink-3">Carregando…</p>
          ) : audit.isError ? (
            <p className="px-5 py-10 text-center text-sm text-danger">{audit.error.message}</p>
          ) : entries.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-3">
              {isFiltered ? "Nenhuma ação com esses filtros." : "Nenhuma ação registrada ainda."}
            </p>
          ) : (
            <div className="flex items-center justify-between gap-3 border-t border-hairline px-5 py-3 text-xs text-ink-3">
              <span>
                {entries.length === 1 ? "1 ação" : `${entries.length} ações`}
                {audit.hasNextPage ? " carregadas" : ""}
              </span>
              {audit.hasNextPage && (
                <Button variant="soft" size="sm" disabled={audit.isFetchingNextPage} onClick={() => audit.fetchNextPage()}>
                  {audit.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
                </Button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

const fieldClass =
  "h-9 rounded-full bg-surface-sunken px-3.5 text-sm text-ink outline-none transition-shadow placeholder:text-ink-3 focus-visible:shadow-[0_0_0_1px_var(--brand-300),0_0_0_4px_var(--brand-100)] [&::-webkit-search-cancel-button]:hidden"

function FilterField({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="px-1 text-xs font-medium text-ink-3">{label}</span>
      {children}
    </label>
  )
}

const timeFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

function AuditRow({ entry, user, canOpen }: { entry: AuditEntryDTO; user?: UserDTO; canOpen: boolean }) {
  const area = AREAS[entry.area]

  return (
    <tr className="border-b border-hairline align-top last:border-0 hover:bg-surface-sunken/60">
      <td className="px-5 py-3 text-ink-2 tabular-nums" title={formatFullDateTime(entry.createdAt)}>
        {timeFormat.format(new Date(entry.createdAt))}
      </td>
      <td className="px-3 py-3">
        {entry.actorId === null ? (
          <span className="inline-flex items-center gap-2 text-ink-3">
            <TerminalSquare className="size-4" /> Sistema
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-ink">
            {user && <UserAvatar user={user} size="sm" withTooltip={false} className="size-5 ring-0" />}
            {entry.actorName ?? "Usuário removido"}
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-ink-2">
          <area.icon className="size-3.5" />
          {area.label}
        </span>
      </td>
      <td className="px-3 py-3 pr-5 leading-relaxed text-ink">
        {entry.summary}
        {canOpen && (
          <Link
            to={`/?tarefa=${entry.taskId}`}
            className="ml-2 inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-brand-700 hover:underline"
          >
            abrir <ExternalLink className="size-3" />
          </Link>
        )}
      </td>
    </tr>
  )
}
