export const TASK_STATUSES = ["todo", "in_progress", "review", "done", "blocked"] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ["urgent", "high", "medium", "low"] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const CATEGORY_KEYS = ["ticket", "infra", "purchase", "project", "routine"] as const
export type CategoryKey = (typeof CATEGORY_KEYS)[number]

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

export interface UserDTO {
  id: number
  name: string
  email: string
  role: UserRole
  jobTitle: string | null
  avatarColor: AvatarColor
}

export interface CategoryDTO {
  key: CategoryKey
  name: string
  checklistTemplate: string[]
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
  assigneeId: number | null
  createdById: number
  checklistDone: number
  checklistTotal: number
  blockedReason: string | null
  lastReturnReason: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
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
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
  }
}
