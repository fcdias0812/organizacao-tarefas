import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type { TaskStatus, TaskSummaryDTO, UserDTO } from "@tarefas/shared"

import { api } from "@/lib/api"
import type { TaskCardData } from "@/lib/domain"
import { queryKeys } from "@/lib/queryClient"

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: async () => (await api<{ users: UserDTO[] }>("GET", "/users")).users,
    staleTime: 5 * 60_000,
  })
}

export function useTasks() {
  return useQuery({
    queryKey: queryKeys.tasks,
    queryFn: async () => (await api<{ tasks: TaskSummaryDTO[] }>("GET", "/tasks")).tasks,
  })
}

export function toCardData(task: TaskSummaryDTO, usersById: Map<number, UserDTO>): TaskCardData {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    category: task.category,
    dueDate: task.dueDate,
    assignees: task.assigneeIds.map((id) => usersById.get(id)).filter((u): u is UserDTO => u !== undefined),
    checklistDone: task.checklistDone,
    checklistTotal: task.checklistTotal,
    blockedReason: task.blockedReason,
    lastReturnReason: task.lastReturnReason,
    commentCount: task.commentCount,
  }
}

/** Tarefas agrupadas por coluna, já na ordem de exibição. */
export function useBoard() {
  const tasks = useTasks()
  const users = useUsers()

  const columns = useMemo(() => {
    const usersById = new Map((users.data ?? []).map((u) => [u.id, u]))
    const grouped: Record<TaskStatus, TaskCardData[]> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
      blocked: [],
    }
    const sorted = [...(tasks.data ?? [])].sort((a, b) => a.position - b.position)
    for (const task of sorted) grouped[task.status].push(toCardData(task, usersById))
    return grouped
  }, [tasks.data, users.data])

  return {
    columns,
    tasks: tasks.data ?? [],
    users: users.data ?? [],
    isPending: tasks.isPending || users.isPending,
    error: tasks.error ?? users.error,
    refetch: () => {
      void tasks.refetch()
      void users.refetch()
    },
  }
}
