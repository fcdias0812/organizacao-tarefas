import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Ban, RotateCcw, Undo2 } from "lucide-react"
import { toast } from "sonner"
import {
  positionBetween,
  previewMove,
  type TaskEventType,
  type TaskStatus,
  type TaskSummaryDTO,
  type UserRole,
} from "@tarefas/shared"

import { api } from "@/lib/api"
import { useAppConfig, type AppConfig } from "@/features/settings/appConfig"
import { queryKeys } from "@/lib/queryClient"

export interface MoveRequest {
  task: TaskSummaryDTO
  status: TaskStatus
  /** Posição na coluna de destino (0 = topo). */
  index?: number
  reason?: string
}

/** Aplica a movimentação na lista local antes da resposta do servidor. */
function applyMove(list: TaskSummaryDTO[], req: MoveRequest, event: TaskEventType | null): TaskSummaryDTO[] {
  const positions = list
    .filter((t) => t.status === req.status && t.id !== req.task.id)
    .map((t) => t.position)
    .sort((a, b) => a - b)
  const position = positionBetween(positions, req.index) ?? (positions[(req.index ?? positions.length) - 1] ?? 0) + 1e-7

  const moved: TaskSummaryDTO = {
    ...req.task,
    status: req.status,
    position,
    blockedReason: event === "blocked" ? (req.reason ?? null) : event === "unblocked" ? null : req.task.blockedReason,
    lastReturnReason:
      event === "returned" ? (req.reason ?? null) : event === "sent_to_review" ? null : req.task.lastReturnReason,
    completedAt: event === "approved" ? new Date().toISOString() : event === "reopened" ? null : req.task.completedAt,
  }
  return list.map((t) => (t.id === moved.id ? moved : t))
}

/**
 * Move um card: atualiza a tela na hora (otimista), confirma no servidor e
 * desfaz com aviso se o servidor recusar.
 */
export function useMoveTask(actorRole: UserRole | undefined) {
  const queryClient = useQueryClient()
  const config = useAppConfig()
  const mutation = useMutation({
    mutationFn: (req: MoveRequest) =>
      api<{ task: TaskSummaryDTO }>("POST", `/tasks/${req.task.id}/move`, {
        status: req.status,
        index: req.index,
        reason: req.reason,
      }),
  })

  function move(req: MoveRequest, options: { silent?: boolean } = {}) {
    if (!actorRole) return
    const preview = previewMove({
      from: req.task.status,
      to: req.status,
      actorRole,
      checklistDone: req.task.checklistDone,
      checklistTotal: req.task.checklistTotal,
    }, config.ruleOptions)
    const event = preview.ok ? preview.event : null

    // Atualização síncrona: o card não "pisca" na coluna antiga ao soltar.
    void queryClient.cancelQueries({ queryKey: queryKeys.tasks })
    const previous = queryClient.getQueryData<TaskSummaryDTO[]>(queryKeys.tasks)
    if (previous) queryClient.setQueryData(queryKeys.tasks, applyMove(previous, req, event))

    const originalIndex = (previous ?? [])
      .filter((t) => t.status === req.task.status)
      .sort((a, b) => a.position - b.position)
      .findIndex((t) => t.id === req.task.id)

    mutation.mutate(req, {
      onSuccess: ({ task }) => {
        queryClient.setQueryData<TaskSummaryDTO[]>(queryKeys.tasks, (list) =>
          list?.map((t) => (t.id === task.id ? task : t))
        )
        if (!options.silent && event) {
          notify(config, event, req.status, () =>
            move({ task, status: req.task.status, index: originalIndex }, { silent: true })
          )
        }
      },
      onError: (error) => {
        if (previous) queryClient.setQueryData(queryKeys.tasks, previous)
        toast.error(error.message)
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.tasks })
        void queryClient.invalidateQueries({ queryKey: queryKeys.task(req.task.id) })
      },
    })
  }

  return { move, isPending: mutation.isPending }
}

function notify({ statusLabel }: AppConfig, event: TaskEventType, status: TaskStatus, undo: () => void) {
  switch (event) {
    case "moved":
      toast(`Movido para ${statusLabel(status)}`, {
        duration: 3500,
        action: { label: "Desfazer", onClick: undo },
      })
      break
    case "sent_to_review":
      toast.success(`Enviado para ${statusLabel("review")}`, { description: "O gestor confere antes de concluir." })
      break
    case "approved":
      toast.success("Aprovado e concluído")
      break
    case "returned":
      toast(`Devolvido para ${statusLabel("in_progress")}`, {
        description: "O motivo ficou registrado no card e no histórico.",
        icon: <Undo2 className="size-4 text-warning" />,
      })
      break
    case "blocked":
      toast("Tarefa bloqueada", { icon: <Ban className="size-4 text-danger" /> })
      break
    case "unblocked":
      toast.success(`Desbloqueada e movida para ${statusLabel(status)}`)
      break
    case "reopened":
      toast("Tarefa reaberta", { icon: <RotateCcw className="size-4 text-brand-600" /> })
      break
  }
}
