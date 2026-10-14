import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { TaskSummaryDTO } from "@tarefas/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/queryClient"

/** Tarefas arquivadas (fora do quadro), das mais recentes para as mais antigas. */
export function useArchivedTasks(enabled = true) {
  return useQuery({
    queryKey: queryKeys.archivedTasks,
    queryFn: async () => (await api<{ tasks: TaskSummaryDTO[] }>("GET", "/tasks/archived")).tasks,
    enabled,
  })
}

/** Arquivar, restaurar e excluir de vez. Atualiza quadro, arquivadas, detalhe e auditoria. */
export function useArchiveActions() {
  const queryClient = useQueryClient()
  const refresh = (id: number) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks })
    void queryClient.invalidateQueries({ queryKey: queryKeys.task(id) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.audit })
  }

  const archive = useMutation({
    mutationFn: (id: number) => api<{ task: TaskSummaryDTO }>("POST", `/tasks/${id}/archive`),
    onSuccess: (_data, id) => refresh(id),
    onError: (error) => toast.error(error.message),
  })

  const restore = useMutation({
    mutationFn: (id: number) => api<{ task: TaskSummaryDTO }>("POST", `/tasks/${id}/restore`),
    onSuccess: (_data, id) => refresh(id),
    onError: (error) => toast.error(error.message),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api<void>("DELETE", `/tasks/${id}`),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.task(id) })
      refresh(id)
    },
    onError: (error) => toast.error(error.message),
  })

  return { archive, restore, remove }
}
