import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { ChecklistItemDTO, TaskDetailDTO, TaskSummaryDTO, UpdateTaskInput } from "@tarefas/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/queryClient"

export function useTaskDetail(id: number | null) {
  return useQuery({
    queryKey: queryKeys.task(id ?? 0),
    queryFn: async () => (await api<{ task: TaskDetailDTO }>("GET", `/tasks/${id}`)).task,
    enabled: id !== null,
  })
}

function toSummary({ checklist: _c, events: _e, ...summary }: TaskDetailDTO): TaskSummaryDTO {
  return summary
}

/** Mantém o card do quadro igual ao detalhe depois de uma edição. */
function syncBoard(queryClient: QueryClient, detail: TaskDetailDTO) {
  queryClient.setQueryData<TaskSummaryDTO[]>(queryKeys.tasks, (list) =>
    list?.map((t) => (t.id === detail.id ? toSummary(detail) : t))
  )
}

/** Aplica uma mudança local no detalhe e no card, devolvendo como desfazer. */
function patchLocal(queryClient: QueryClient, id: number, update: (task: TaskDetailDTO) => TaskDetailDTO) {
  const key = queryKeys.task(id)
  const previousDetail = queryClient.getQueryData<TaskDetailDTO>(key)
  const previousList = queryClient.getQueryData<TaskSummaryDTO[]>(queryKeys.tasks)
  if (previousDetail) {
    const next = update(previousDetail)
    queryClient.setQueryData(key, next)
    syncBoard(queryClient, next)
  }
  return () => {
    queryClient.setQueryData(key, previousDetail)
    queryClient.setQueryData(queryKeys.tasks, previousList)
  }
}

const withCounts = (task: TaskDetailDTO, checklist: ChecklistItemDTO[]): TaskDetailDTO => ({
  ...task,
  checklist,
  checklistTotal: checklist.length,
  checklistDone: checklist.filter((i) => i.isDone).length,
})

export function useUpdateTask(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: UpdateTaskInput) => api<{ task: TaskDetailDTO }>("PATCH", `/tasks/${id}`, patch),
    onSuccess: ({ task }) => {
      queryClient.setQueryData(queryKeys.task(id), task)
      syncBoard(queryClient, task)
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useChecklist(taskId: number, actorId: number) {
  const queryClient = useQueryClient()
  const path = `/tasks/${taskId}/checklist`
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) })

  const toggle = useMutation({
    mutationFn: ({ item, isDone }: { item: ChecklistItemDTO; isDone: boolean }) =>
      api<{ item: ChecklistItemDTO }>("PATCH", `${path}/${item.id}`, { isDone }),
    onMutate: ({ item, isDone }) =>
      patchLocal(queryClient, taskId, (task) =>
        withCounts(
          task,
          task.checklist.map((i) =>
            i.id === item.id
              ? { ...i, isDone, doneById: isDone ? actorId : null, doneAt: isDone ? new Date().toISOString() : null }
              : i
          )
        )
      ),
    onError: (error, _vars, undo) => {
      undo?.()
      toast.error(error.message)
    },
  })

  const add = useMutation({
    mutationFn: (label: string) => api<{ item: ChecklistItemDTO }>("POST", path, { label }),
    onSuccess: ({ item }) => {
      patchLocal(queryClient, taskId, (task) => withCounts(task, [...task.checklist, item]))
    },
    onError: (error) => toast.error(error.message),
    onSettled: refresh,
  })

  const remove = useMutation({
    mutationFn: (item: ChecklistItemDTO) => api<void>("DELETE", `${path}/${item.id}`),
    onMutate: (item) =>
      patchLocal(queryClient, taskId, (task) => withCounts(task, task.checklist.filter((i) => i.id !== item.id))),
    onError: (error, _item, undo) => {
      undo?.()
      toast.error(error.message)
    },
  })

  return { toggle, add, remove }
}
