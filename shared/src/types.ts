export const TASK_STATUSES = ["todo", "in_progress", "review", "done", "blocked"] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ["urgent", "high", "medium", "low"] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

/** Chave da categoria (gerada a partir do nome na criação e nunca muda). */
export type CategoryKey = string

export const USER_ROLES = ["manager", "executor"] as const
export type UserRole = (typeof USER_ROLES)[number]

export const AVATAR_COLORS = ["violet", "teal", "amber", "rose", "sky"] as const
export type AvatarColor = (typeof AVATAR_COLORS)[number]

export type TaskEventType =
  | "created"
  | "moved"
  | "sent_to_review"
  | "approved"
  | "returned"
  | "blocked"
  | "unblocked"
  | "reopened"
  | "assigned"
  | "updated"
  | "archived"
  | "restored"

export interface UserDTO {
  id: number
  name: string
  email: string
  role: UserRole
  /** Administrador acessa Configurações. Sempre é também gestor. */
  isAdmin: boolean
  jobTitle: string | null
  avatarColor: AvatarColor
}

/** Usuário como o administrador vê em Configurações. */
export interface AdminUserDTO extends UserDTO {
  isActive: boolean
  createdAt: string
}

export interface CategoryDTO {
  key: CategoryKey
  name: string
  /** Nome do ícone (ver CATEGORY_ICONS). */
  icon: string
  isActive: boolean
  position: number
  checklistTemplate: string[]
  /** Quantas tarefas usam a categoria (só vem para o administrador). */
  taskCount?: number
}

export interface CommentDTO {
  id: number
  authorId: number
  body: string
  createdAt: string
  updatedAt: string
}

/** Dados do card no quadro. */
export interface TaskSummaryDTO {
  id: number
  title: string
  description: string
  status: TaskStatus
  position: number
  priority: TaskPriority
  category: CategoryKey
  dueDate: string | null
  /** Responsáveis, na ordem em que foram incluídos (pode ser vazio). */
  assigneeIds: number[]
  createdById: number
  checklistDone: number
  checklistTotal: number
  blockedReason: string | null
  lastReturnReason: string | null
  commentCount: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
  /** Arquivada: fora do quadro, com histórico preservado (dá para restaurar). */
  archivedAt: string | null
  archivedById: number | null
}

export interface ChecklistItemDTO {
  id: number
  label: string
  isDone: boolean
  isFromTemplate: boolean
  doneById: number | null
  doneAt: string | null
  position: number
}

export interface TaskEventDTO {
  id: number
  type: TaskEventType
  actorId: number
  fromStatus: TaskStatus | null
  toStatus: TaskStatus | null
  reason: string | null
  detail: Record<string, unknown> | null
  createdAt: string
}

/** Dados completos para o painel lateral. */
export interface TaskDetailDTO extends TaskSummaryDTO {
  checklist: ChecklistItemDTO[]
  events: TaskEventDTO[]
  comments: CommentDTO[]
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
  }
}

/* ───────────────────────── auditoria ───────────────────────── */

/** Áreas do sistema registradas na auditoria. */
export const AUDIT_AREAS = ["access", "tasks", "checklist", "comments", "users", "categories", "settings"] as const
export type AuditArea = (typeof AUDIT_AREAS)[number]

/** Uma ação registrada: quem fez, onde, quando e uma frase pronta descrevendo o que mudou. */
export interface AuditEntryDTO {
  id: number
  /** null = feito pela linha de comando (fora da tela). */
  actorId: number | null
  actorName: string | null
  area: AuditArea
  action: string
  /** Tarefa envolvida, quando houver (pode já ter sido excluída de vez). */
  taskId: number | null
  summary: string
  createdAt: string
}
