import {
  FolderKanban,
  Headset,
  RefreshCw,
  Server,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react"

import type { AvatarColor, CategoryKey, TaskPriority, TaskStatus, UserRole } from "@tarefas/shared"

// Os tipos de domínio vêm do pacote compartilhado com o servidor; aqui ficam
// só os metadados de interface (rótulos, ícones, cores).
export type { AvatarColor, CategoryKey, TaskPriority, TaskStatus, UserRole }

export interface User {
  id: number
  name: string
  role: UserRole
  avatarColor: AvatarColor
  jobTitle?: string | null
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
}

export const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "review", "done", "blocked"]

export const STATUS_META: Record<TaskStatus, { label: string; emptyTitle: string; emptyHint: string }> = {
  todo: {
    label: "A fazer",
    emptyTitle: "Fila zerada",
    emptyHint: "Aperte N para lançar uma tarefa em segundos.",
  },
  in_progress: {
    label: "Em andamento",
    emptyTitle: "Nada em execução",
    emptyHint: "Arraste um card de A fazer quando começar a trabalhar nele.",
  },
  review: {
    label: "Revisão",
    emptyTitle: "Nada aguardando revisão",
    emptyHint: "Os cards chegam aqui com o checklist 100% marcado.",
  },
  done: {
    label: "Concluído",
    emptyTitle: "Nenhuma entrega ainda",
    emptyHint: "Tarefas aprovadas pelo gestor aparecem aqui.",
  },
  blocked: {
    label: "Bloqueado",
    emptyTitle: "Tudo fluindo",
    emptyHint: "Nenhum bloqueio no momento. Que continue assim.",
  },
}

export const PRIORITY_ORDER: TaskPriority[] = ["urgent", "high", "medium", "low"]

export const PRIORITY_META: Record<TaskPriority, { label: string; dotClass: string }> = {
  urgent: { label: "Urgente", dotClass: "bg-priority-urgent" },
  high: { label: "Alta", dotClass: "bg-priority-high" },
  medium: { label: "Média", dotClass: "bg-priority-medium" },
  low: { label: "Baixa", dotClass: "bg-priority-low" },
}

export const CATEGORY_ORDER: CategoryKey[] = ["ticket", "infra", "purchase", "project", "routine"]

export const CATEGORY_META: Record<CategoryKey, { label: string; icon: LucideIcon }> = {
  ticket: { label: "Chamado", icon: Headset },
  infra: { label: "Infra", icon: Server },
  purchase: { label: "Compra", icon: ShoppingCart },
  project: { label: "Projeto", icon: FolderKanban },
  routine: { label: "Rotina", icon: RefreshCw },
}

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
