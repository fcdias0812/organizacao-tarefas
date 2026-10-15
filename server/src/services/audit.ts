import type {
  AdminUserDTO,
  AuditArea,
  AuditEntryDTO,
  AuditQuery,
  CategoryDTO,
  SettingsDTO,
  TaskPriority,
  TaskStatus,
  TaskSummaryDTO,
} from "@tarefas/shared"

import type { Db, SqlValue } from "../db/connection"
import { listCategories } from "./categories"
import { getSettings } from "./settings"
import { listAllUsers } from "./users"

/**
 * Auditoria: cada ação feita no sistema vira uma linha com quem fez, a área e uma frase
 * pronta em português (gravada na hora, com os nomes daquele momento). Só recebe inserções.
 */

export interface AuditInput {
  /** null = linha de comando. */
  actorId: number | null
  area: AuditArea
  action: string
  summary: string
  taskId?: number | null
}

export async function recordAudit(db: Db, entry: AuditInput) {
  await db.run(
    "INSERT INTO audit_log (actor_id, area, action, task_id, summary, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    entry.actorId,
    entry.area,
    entry.action,
    entry.taskId ?? null,
    entry.summary,
    new Date().toISOString()
  )
}

interface AuditRow {
  id: number
  actor_id: number | null
  actor_name: string | null
  area: AuditArea
  action: string
  task_id: number | null
  summary: string
  created_at: string
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

export async function listAudit(db: Db, query: AuditQuery): Promise<{ entries: AuditEntryDTO[]; hasMore: boolean }> {
  const where: string[] = []
  const args: SqlValue[] = []
  if (query.since) {
    where.push("a.created_at >= ?")
    args.push(query.since)
  }
  if (query.until) {
    where.push("a.created_at <= ?")
    args.push(query.until)
  }
  if (query.actor === "system") where.push("a.actor_id IS NULL")
  else if (query.actor !== undefined) {
    where.push("a.actor_id = ?")
    args.push(query.actor)
  }
  if (query.area) {
    where.push("a.area = ?")
    args.push(query.area)
  }
  if (query.q) {
    where.push("a.summary LIKE ? ESCAPE '\\'")
    args.push(`%${escapeLike(query.q)}%`)
  }

  const order = query.order === "asc" ? "ASC" : "DESC"
  const rows = await db.all<AuditRow>(
    `SELECT a.*, u.name AS actor_name
     FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY a.created_at ${order}, a.id ${order}
     LIMIT ? OFFSET ?`,
    ...args,
    query.limit + 1,
    query.offset
  )

  return {
    hasMore: rows.length > query.limit,
    entries: rows.slice(0, query.limit).map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      actorName: r.actor_name,
      area: r.area,
      action: r.action,
      taskId: r.task_id,
      summary: r.summary,
      createdAt: r.created_at,
    })),
  }
}

/* ───────────────────────── frases ───────────────────────── */

export const quote = (text: string, max = 120) => `“${text.length > max ? `${text.slice(0, max - 1)}…` : text}”`

export const taskRef = (task: { id: number; title: string }) => `TI-${task.id} ${quote(task.title, 80)}`

/** AAAA-MM-DD → DD/MM/AAAA. */
export const formatDay = (date: string | null) => (date ? date.split("-").reverse().join("/") : "sem prazo")

const arrow = (from: string, to: string) => `${from} → ${to}`

export const joinParts = (parts: string[]) =>
  parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join("; ")} e ${parts.at(-1)}`

/** Nomes do momento da ação: colunas, prioridades, categorias e pessoas. */
export interface AuditContext {
  settings: SettingsDTO
  status: (status: TaskStatus) => string
  priority: (priority: TaskPriority) => string
  category: (key: string) => string
  /** "Ana", "Ana e Bruno", "Ana, Bruno e Carla" ou "sem responsável". */
  users: (ids: number[]) => string
}

const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`

export async function auditContext(db: Db): Promise<AuditContext> {
  const [settings, categories, users] = await Promise.all([getSettings(db), listCategories(db), listAllUsers(db)])
  return {
    settings,
    status: (s) => settings.statusLabels[s],
    priority: (p) => settings.priorities[p].label,
    category: (key) => categories.find((c) => c.key === key)?.name ?? key,
    users: (ids) =>
      ids.length === 0 ? "sem responsável" : joinNames(ids.map((id) => users.find((u) => u.id === id)?.name ?? `usuário ${id}`)),
  }
}

const responsibles = (ids: number[], ctx: AuditContext) =>
  ids.length === 0 ? "sem responsável" : `${ids.length === 1 ? "responsável" : "responsáveis"} ${ctx.users(ids)}`

/** Resumo de uma tarefa nova: categoria, prioridade, responsáveis e prazo. */
export function describeNewTask(task: TaskSummaryDTO, ctx: AuditContext) {
  const parts = [ctx.category(task.category), `prioridade ${ctx.priority(task.priority)}`, responsibles(task.assigneeIds, ctx)]
  if (task.dueDate) parts.push(`prazo ${formatDay(task.dueDate)}`)
  return parts.join(", ")
}

/** O que mudou numa edição de tarefa, campo a campo. */
export function describeTaskChanges(before: TaskSummaryDTO, after: TaskSummaryDTO, ctx: AuditContext): string[] {
  const parts: string[] = []
  if (before.title !== after.title) parts.push(`título (${arrow(quote(before.title, 60), quote(after.title, 60))})`)
  if (before.description !== after.description) parts.push("descrição")
  if (before.priority !== after.priority) parts.push(`prioridade (${arrow(ctx.priority(before.priority), ctx.priority(after.priority))})`)
  if (before.dueDate !== after.dueDate) parts.push(`prazo (${arrow(formatDay(before.dueDate), formatDay(after.dueDate))})`)
  if (before.category !== after.category) parts.push(`categoria (${arrow(ctx.category(before.category), ctx.category(after.category))})`)
  const sameAssignees =
    before.assigneeIds.length === after.assigneeIds.length && before.assigneeIds.every((id) => after.assigneeIds.includes(id))
  if (!sameAssignees) parts.push(`responsáveis (${arrow(ctx.users(before.assigneeIds), ctx.users(after.assigneeIds))})`)
  return parts
}

const PROFILE = (u: { role: string; isAdmin: boolean }) => (u.isAdmin ? "administrador" : u.role === "manager" ? "gestor" : "executor")

export function describeNewUser(user: AdminUserDTO) {
  return `cadastrou o usuário ${user.name} (${user.email}) como ${PROFILE(user)}`
}

export function describeUserChanges(before: AdminUserDTO, after: AdminUserDTO): string[] {
  const parts: string[] = []
  if (before.name !== after.name) parts.push(`nome (${arrow(before.name, after.name)})`)
  if (before.email !== after.email) parts.push(`e-mail (${arrow(before.email, after.email)})`)
  if (PROFILE(before) !== PROFILE(after)) parts.push(`perfil (${arrow(PROFILE(before), PROFILE(after))})`)
  if (before.jobTitle !== after.jobTitle) parts.push(`cargo (${arrow(before.jobTitle ?? "sem cargo", after.jobTitle ?? "sem cargo")})`)
  if (before.avatarColor !== after.avatarColor) parts.push("cor do avatar")
  if (before.isActive !== after.isActive) parts.push(after.isActive ? "reativou o acesso" : "desativou o acesso")
  return parts
}

export function describeCategoryChanges(before: CategoryDTO, after: CategoryDTO): string[] {
  const parts: string[] = []
  if (before.name !== after.name) parts.push(`nome (${arrow(before.name, after.name)})`)
  if (before.icon !== after.icon) parts.push("ícone")
  if (before.isActive !== after.isActive) parts.push(after.isActive ? "reativou" : "desativou")
  if (before.checklistTemplate.join("\n") !== after.checklistTemplate.join("\n")) {
    parts.push(`checklist padrão (${arrow(`${before.checklistTemplate.length} itens`, `${after.checklistTemplate.length} itens`)})`)
  }
  return parts
}

export function describeSettingsChanges(before: SettingsDTO, after: SettingsDTO): string[] {
  const parts: string[] = []
  if (before.appName !== after.appName) parts.push(`nome do sistema (${arrow(quote(before.appName), quote(after.appName))})`)
  if (before.brandColor !== after.brandColor) parts.push(`cor principal (${arrow(before.brandColor, after.brandColor)})`)
  if (before.soonDays !== after.soonDays) parts.push(`aviso de prazo próximo (${arrow(`${before.soonDays}`, `${after.soonDays} dias`)})`)
  if (before.reasonMinLength !== after.reasonMinLength) {
    parts.push(`tamanho mínimo do motivo (${arrow(`${before.reasonMinLength}`, `${after.reasonMinLength} caracteres`)})`)
  }
  for (const status of Object.keys(after.statusLabels) as TaskStatus[]) {
    if (before.statusLabels[status] !== after.statusLabels[status]) {
      parts.push(`nome da coluna (${arrow(quote(before.statusLabels[status]), quote(after.statusLabels[status]))})`)
    }
  }
  for (const priority of Object.keys(after.priorities) as TaskPriority[]) {
    const [b, a] = [before.priorities[priority], after.priorities[priority]]
    if (b.label !== a.label) parts.push(`nome da prioridade (${arrow(quote(b.label), quote(a.label))})`)
    if (b.color !== a.color) parts.push(`cor da prioridade ${a.label} (${arrow(b.color, a.color)})`)
  }
  return parts
}
