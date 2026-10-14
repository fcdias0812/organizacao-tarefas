import type { AvatarColor, CategoryKey, TaskPriority, TaskStatus, UserRole } from "@tarefas/shared"

// Os tipos de domínio vêm do pacote compartilhado com o servidor. Nomes de
// colunas, prioridades e categorias são configuráveis: use useAppConfig().
export type { AvatarColor, CategoryKey, TaskPriority, TaskStatus, UserRole }

export interface User {
  id: number
  name: string
  role: UserRole
  avatarColor: AvatarColor
  jobTitle?: string | null
  isAdmin?: boolean
}

export interface TaskCardData {
  id: number
  title: string
  status: TaskStatus
  priority: TaskPriority
  category: CategoryKey
  dueDate: string | null // AAAA-MM-DD
  assignee: User | null
  checklistDone: number
  checklistTotal: number
  blockedReason?: string | null
  lastReturnReason?: string | null
  commentCount?: number
}

export const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "review", "done", "blocked"]

/** Textos do estado vazio de cada coluna (não citam nomes de colunas, que são configuráveis). */
export const EMPTY_COLUMN_COPY: Record<TaskStatus, { title: string; hint: string }> = {
  todo: { title: "Fila zerada", hint: "Aperte N para lançar uma tarefa em segundos." },
  in_progress: { title: "Nada em execução", hint: "Arraste um card para cá quando começar a trabalhar nele." },
  review: { title: "Nada aguardando revisão", hint: "Os cards chegam aqui com o checklist 100% marcado." },
  done: { title: "Nenhuma entrega ainda", hint: "Tarefas aprovadas pelo gestor aparecem aqui." },
  blocked: { title: "Tudo fluindo", hint: "Nenhum bloqueio no momento. Que continue assim." },
}

export const PRIORITY_ORDER: TaskPriority[] = ["urgent", "high", "medium", "low"]

export const AVATAR_COLORS: Record<AvatarColor, string> = {
  violet: "bg-brand-100 text-brand-700",
  teal: "bg-[#dff5f0] text-[#0f6e5f]",
  amber: "bg-[#fdf0d9] text-[#9a5b06]",
  rose: "bg-[#fde7ec] text-[#b4234a]",
  sky: "bg-[#e0f0fd] text-[#155d9c]",
}

/** "Juliana Souza" → "JS" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

export const ROLE_LABEL: Record<UserRole, string> = {
  manager: "Gestor",
  executor: "Executor",
}

export function profileLabel(user: { role: UserRole; isAdmin?: boolean }): string {
  return user.isAdmin ? "Administrador" : ROLE_LABEL[user.role]
}
