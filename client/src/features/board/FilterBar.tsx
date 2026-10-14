import { ChevronDown, Search, X } from "lucide-react"
import type { UserDTO } from "@tarefas/shared"
import { cn } from "cn"

import { CategoryLabel, PriorityDot, UserAvatar } from "@/components/task/TaskMeta"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { useAppConfig } from "@/features/settings/appConfig"
import { PRIORITY_ORDER } from "@/lib/domain"
import type { AssigneeFilter, useBoardFilters } from "./useBoardFilters"

type FiltersApi = ReturnType<typeof useBoardFilters>

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

interface FilterBarProps {
  api: FiltersApi
  users: UserDTO[]
  me: UserDTO
  /** Quantos cards aparecem com os filtros atuais. */
  visibleCount: number
  /** Campo de busca, para o atalho "/" focar nele. */
  searchRef?: React.Ref<HTMLInputElement>
}

export function FilterBar({ api, users, me, visibleCount, searchRef }: FilterBarProps) {
  const { filters } = api
  const config = useAppConfig()
  const userName = (id: AssigneeFilter) =>
    id === "none" ? "Sem responsável" : id === me.id ? "Eu" : (users.find((u) => u.id === id)?.name.split(" ")[0] ?? "?")

  return (
    <div className="scroll-soft -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
      <div className="relative w-56 shrink-0 sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
        <input
          ref={searchRef}
          type="search"
          value={filters.query}
          onChange={(e) => api.setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && (e.currentTarget.value ? api.setQuery("") : e.currentTarget.blur())}
          placeholder="Buscar tarefas"
          aria-label="Buscar tarefas"
          className="h-9 w-full rounded-full bg-surface pr-9 pl-10 text-sm text-ink shadow-card outline-none transition-shadow placeholder:text-ink-3 focus-visible:shadow-[0_0_0_1px_var(--brand-300),0_0_0_4px_var(--brand-100)] [&::-webkit-search-cancel-button]:hidden"
        />
        {filters.query ? (
          <button
            type="button"
            onClick={() => api.setQuery("")}
            aria-label="Limpar busca"
            className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-surface-sunken hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <Kbd className="absolute top-1/2 right-3 -translate-y-1/2">/</Kbd>
        )}
      </div>

      <FilterMenu
        label="Responsável"
        selectedLabel={filters.assignees.length === 1 ? userName(filters.assignees[0]) : undefined}
        count={filters.assignees.length}
        onClear={() => api.setAssignees([])}
      >
        <DropdownMenuCheckboxItem
          checked={filters.assignees.includes(me.id)}
          onCheckedChange={() => api.setAssignees(toggle(filters.assignees, me.id))}
          onSelect={(e) => e.preventDefault()}
        >
          <UserAvatar user={me} size="sm" withTooltip={false} className="size-5 ring-0" />
          Minhas tarefas
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {users
          .filter((u) => u.id !== me.id)
          .map((u) => (
            <DropdownMenuCheckboxItem
              key={u.id}
              checked={filters.assignees.includes(u.id)}
              onCheckedChange={() => api.setAssignees(toggle(filters.assignees, u.id))}
              onSelect={(e) => e.preventDefault()}
            >
              <UserAvatar user={u} size="sm" withTooltip={false} className="size-5 ring-0" />
              {u.name}
            </DropdownMenuCheckboxItem>
          ))}
        <DropdownMenuCheckboxItem
          checked={filters.assignees.includes("none")}
          onCheckedChange={() => api.setAssignees(toggle<AssigneeFilter>(filters.assignees, "none"))}
          onSelect={(e) => e.preventDefault()}
        >
          <span className="size-5 rounded-full border-[1.5px] border-dashed border-ink-4" />
          Sem responsável
        </DropdownMenuCheckboxItem>
      </FilterMenu>

      <FilterMenu
        label="Categoria"
        selectedLabel={filters.categories.length === 1 ? config.category(filters.categories[0]).label : undefined}
        count={filters.categories.length}
        onClear={() => api.setCategories([])}
      >
        {config.activeCategories.map(({ key: c }) => (
          <DropdownMenuCheckboxItem
            key={c}
            checked={filters.categories.includes(c)}
            onCheckedChange={() => api.setCategories(toggle(filters.categories, c))}
            onSelect={(e) => e.preventDefault()}
          >
            <CategoryLabel category={c} className="text-sm text-ink" />
          </DropdownMenuCheckboxItem>
        ))}
      </FilterMenu>

      <FilterMenu
        label="Prioridade"
        selectedLabel={filters.priorities.length === 1 ? config.priority(filters.priorities[0]).label : undefined}
        count={filters.priorities.length}
        onClear={() => api.setPriorities([])}
      >
        {PRIORITY_ORDER.map((p) => (
          <DropdownMenuCheckboxItem
            key={p}
            checked={filters.priorities.includes(p)}
            onCheckedChange={() => api.setPriorities(toggle(filters.priorities, p))}
            onSelect={(e) => e.preventDefault()}
          >
            <PriorityDot priority={p} showLabel className="text-sm text-ink" />
          </DropdownMenuCheckboxItem>
        ))}
      </FilterMenu>

      {api.isActive && (
        <>
          <span className="shrink-0 pl-1 text-[13px] text-ink-3 tabular-nums" aria-live="polite">
            {visibleCount === 1 ? "1 card" : `${visibleCount} cards`}
          </span>
          <button
            type="button"
            onClick={api.clear}
            className="h-8 shrink-0 rounded-full px-3 text-[13px] font-medium text-brand-700 transition-colors hover:bg-brand-50"
          >
            Limpar filtros
          </button>
        </>
      )}
    </div>
  )
}

function FilterMenu({
  label,
  selectedLabel,
  count,
  onClear,
  children,
}: {
  label: string
  selectedLabel?: string
  count: number
  onClear: () => void
  children: React.ReactNode
}) {
  const active = count > 0
  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center rounded-full transition-[background-color,box-shadow]",
        active ? "bg-brand-50" : "bg-surface shadow-card hover:shadow-card-hover"
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full text-[13px] font-medium outline-none focus-visible:ring-4 focus-visible:ring-brand-100",
            active ? "pr-1 pl-3.5 text-brand-700" : "px-3.5 text-ink-2 hover:text-ink"
          )}
        >
          {active ? (
            <>
              {label}: {selectedLabel ?? count}
            </>
          ) : (
            <>
              {label}
              <ChevronDown className="size-3.5 text-ink-3" />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
      {active && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Limpar filtro de ${label.toLowerCase()}`}
          className="mr-1.5 grid size-6 place-items-center rounded-full text-brand-700 transition-colors hover:bg-brand-100"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
