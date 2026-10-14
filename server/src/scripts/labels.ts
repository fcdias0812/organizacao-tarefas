import type { TaskStatus } from "@tarefas/shared"

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "A fazer",
  in_progress: "Em andamento",
  review: "Revisão",
  done: "Concluído",
  blocked: "Bloqueado",
}
