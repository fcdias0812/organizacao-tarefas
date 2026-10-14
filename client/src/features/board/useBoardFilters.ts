import { useMemo } from "react"
import { useSearchParams } from "react-router"
import {
  CATEGORY_KEYS,
  TASK_PRIORITIES,
  type CategoryKey,
  type TaskPriority,
  type TaskSummaryDTO,
} from "@tarefas/shared"

/** Responsável: id do usuário ou "none" (sem responsável). */
export type AssigneeFilter = number | "none"

export interface BoardFilters {
  query: string
  assignees: AssigneeFilter[]
  categories: CategoryKey[]
  priorities: TaskPriority[]
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

const readList = (value: string | null) => (value ? value.split(",").filter(Boolean) : [])

/**
 * Filtros do quadro guardados na URL (?q=&resp=&cat=&pri=), para o link
 * filtrado poder ser compartilhado e sobreviver a um recarregar.
 */
export function useBoardFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<BoardFilters>(
    () => ({
      query: params.get("q") ?? "",
      assignees: readList(params.get("resp")).map((v) => (v === "none" ? "none" : Number(v))),
      categories: readList(params.get("cat")).filter((v): v is CategoryKey => CATEGORY_KEYS.includes(v as CategoryKey)),
      priorities: readList(params.get("pri")).filter((v): v is TaskPriority => TASK_PRIORITIES.includes(v as TaskPriority)),
    }),
    [params]
  )

  const update = (key: string, value: string) =>
    setParams(
      (prev) => {
        if (value) prev.set(key, value)
        else prev.delete(key)
        return prev
      },
      { replace: true }
    )

  const isActive =
    filters.query.trim() !== "" ||
    filters.assignees.length > 0 ||
    filters.categories.length > 0 ||
    filters.priorities.length > 0

  return {
    filters,
    isActive,
    setQuery: (q: string) => update("q", q),
    setAssignees: (list: AssigneeFilter[]) => update("resp", list.join(",")),
    setCategories: (list: CategoryKey[]) => update("cat", list.join(",")),
    setPriorities: (list: TaskPriority[]) => update("pri", list.join(",")),
    clear: () =>
      setParams(
        (prev) => {
          for (const key of ["q", "resp", "cat", "pri"]) prev.delete(key)
          return prev
        },
        { replace: true }
      ),
  }
}

/** Ids das tarefas que passam nos filtros, ou null quando não há filtro. */
export function filterTasks(tasks: TaskSummaryDTO[], filters: BoardFilters, active: boolean): Set<number> | null {
  if (!active) return null
  const terms = normalize(filters.query).split(/\s+/).filter(Boolean)

  return new Set(
    tasks
      .filter((t) => {
        if (filters.assignees.length && !filters.assignees.includes(t.assigneeId ?? "none")) return false
        if (filters.categories.length && !filters.categories.includes(t.category)) return false
        if (filters.priorities.length && !filters.priorities.includes(t.priority)) return false
        if (terms.length) {
          const haystack = normalize(`ti-${t.id} ${t.title} ${t.description}`)
          if (!terms.every((term) => haystack.includes(term))) return false
        }
        return true
      })
      .map((t) => t.id)
  )
}
