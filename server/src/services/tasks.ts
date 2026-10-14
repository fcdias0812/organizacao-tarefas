import {
  checkAssign,
  checkChecklistEditable,
  checkChecklistItemRemoval,
  checkMove,
  POSITION_STEP,
  positionBetween,
  type Actor,
  type CategoryKey,
  type ChecklistItemDTO,
  type CreateChecklistItemInput,
  type CreateTaskInput,
  type MoveTaskInput,
  type TaskDetailDTO,
  type TaskEventDTO,
  type TaskEventType,
  type TaskPriority,
  type TaskStatus,
  type TaskSummaryDTO,
  type UpdateChecklistItemInput,
  type UpdateTaskInput,
} from "@tarefas/shared"

import { transaction, type Db } from "../db/connection"
import { assertRule, HttpError, notFound } from "../http/errors"
import { getCategoryId, getTemplate } from "./categories"
import { findUserById } from "./users"

/* ───────────────────────── leitura ───────────────────────── */

interface TaskRow {
  id: number
  title: string
  description: string
  status: TaskStatus
  position: number
  priority: TaskPriority
  due_date: string | null
  category_key: CategoryKey
  category_id: number
  assignee_id: number | null
  created_by: number
  blocked_reason: string | null
  blocked_from_status: TaskStatus | null
  last_return_reason: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  checklist_done: number
  checklist_total: number
}

const TASK_SELECT = `
  SELECT t.*, c.key AS category_key,
    (SELECT COUNT(*) FROM checklist_items i WHERE i.task_id = t.id) AS checklist_total,
    (SELECT COUNT(*) FROM checklist_items i WHERE i.task_id = t.id AND i.is_done = 1) AS checklist_done
  FROM tasks t
  JOIN categories c ON c.id = t.category_id`

function toSummary(row: TaskRow): TaskSummaryDTO {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    position: row.position,
    priority: row.priority,
    category: row.category_key,
    dueDate: row.due_date,
    assigneeId: row.assignee_id,
    createdById: row.created_by,
    checklistDone: row.checklist_done,
    checklistTotal: row.checklist_total,
    blockedReason: row.blocked_reason,
    lastReturnReason: row.last_return_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  }
}

function getTaskRow(db: Db, id: number): TaskRow {
  const row = db.prepare(`${TASK_SELECT} WHERE t.id = ?`).get(id) as TaskRow | undefined
  if (!row) throw notFound("Tarefa não encontrada.")
  return row
}

export function listTasks(db: Db): TaskSummaryDTO[] {
  const rows = db.prepare(`${TASK_SELECT} ORDER BY t.status, t.position`).all() as unknown as TaskRow[]
  return rows.map(toSummary)
}

export function getTaskSummary(db: Db, id: number): TaskSummaryDTO {
  return toSummary(getTaskRow(db, id))
}

interface ChecklistRow {
  id: number
  task_id: number
  label: string
  is_done: number
  is_from_template: number
  done_by: number | null
  done_at: string | null
  position: number
}

const toChecklistItem = (r: ChecklistRow): ChecklistItemDTO => ({
  id: r.id,
  label: r.label,
  isDone: r.is_done === 1,
  isFromTemplate: r.is_from_template === 1,
  doneById: r.done_by,
  doneAt: r.done_at,
  position: r.position,
})

interface EventRow {
  id: number
  type: TaskEventType
  actor_id: number
  from_status: TaskStatus | null
  to_status: TaskStatus | null
  reason: string | null
  detail: string | null
  created_at: string
}

const toEvent = (r: EventRow): TaskEventDTO => ({
  id: r.id,
  type: r.type,
  actorId: r.actor_id,
  fromStatus: r.from_status,
  toStatus: r.to_status,
  reason: r.reason,
  detail: r.detail ? (JSON.parse(r.detail) as Record<string, unknown>) : null,
  createdAt: r.created_at,
})

export function getTaskDetail(db: Db, id: number): TaskDetailDTO {
  const row = getTaskRow(db, id)
  const checklist = db
    .prepare("SELECT * FROM checklist_items WHERE task_id = ? ORDER BY position, id")
    .all(id) as unknown as ChecklistRow[]
  const events = db
    .prepare("SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at, id")
    .all(id) as unknown as EventRow[]

  return {
    ...toSummary(row),
    checklist: checklist.map(toChecklistItem),
    events: events.map(toEvent),
  }
}

/* ───────────────────────── apoio ───────────────────────── */

const now = () => new Date().toISOString()

export function recordEvent(
  db: Db,
  event: {
    taskId: number
    actorId: number
    type: TaskEventType
    from?: TaskStatus | null
    to?: TaskStatus | null
    reason?: string | null
    detail?: Record<string, unknown> | null
    at?: string
  }
) {
  db.prepare(
    `INSERT INTO task_events (task_id, actor_id, type, from_status, to_status, reason, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    event.taskId,
    event.actorId,
    event.type,
    event.from ?? null,
    event.to ?? null,
    event.reason ?? null,
    event.detail ? JSON.stringify(event.detail) : null,
    event.at ?? now()
  )
}

/**
 * Posição fracionária para inserir um card no índice `index` da coluna, sem
 * precisar renumerar os vizinhos. `index` omitido = fim da coluna.
 */
export function positionFor(db: Db, status: TaskStatus, index: number | undefined, excludeId = 0): number {
  const rows = db
    .prepare("SELECT id, position FROM tasks WHERE status = ? AND id != ? ORDER BY position")
    .all(status, excludeId) as { id: number; position: number }[]

  const position = positionBetween(
    rows.map((r) => r.position),
    index
  )
  if (position !== null) return position

  // Sem espaço entre os vizinhos: renumera a coluna e tenta de novo.
  const update = db.prepare("UPDATE tasks SET position = ? WHERE id = ?")
  rows.forEach((r, k) => update.run((k + 1) * POSITION_STEP, r.id))
  return positionFor(db, status, index, excludeId)
}

function ensureAssignable(db: Db, actor: Actor, assigneeId: number | null) {
  assertRule(checkAssign(actor, assigneeId))
  if (assigneeId !== null && !findUserById(db, assigneeId)) {
    throw new HttpError(422, "validation_error", "Responsável não encontrado.")
  }
}

function insertTemplateItems(db: Db, taskId: number, categoryId: number, startPosition = 1) {
  const insert = db.prepare(
    "INSERT INTO checklist_items (task_id, label, is_from_template, position) VALUES (?, ?, 1, ?)"
  )
  getTemplate(db, categoryId).forEach((label, k) => insert.run(taskId, label, startPosition + k))
}

/* ───────────────────────── escrita ───────────────────────── */

export function createTask(db: Db, actor: Actor, input: CreateTaskInput): TaskDetailDTO {
  const assigneeId = input.assigneeId === undefined ? actor.id : input.assigneeId
  ensureAssignable(db, actor, assigneeId)

  const id = transaction(db, () => {
    const categoryId = getCategoryId(db, input.category)
    const timestamp = now()
    const result = db
      .prepare(
        `INSERT INTO tasks (title, description, status, position, priority, due_date, category_id,
                            assignee_id, created_by, created_at, updated_at)
         VALUES (?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.title,
        input.description,
        positionFor(db, "todo", 0),
        input.priority,
        input.dueDate,
        categoryId,
        assigneeId,
        actor.id,
        timestamp,
        timestamp
      )
    const taskId = Number(result.lastInsertRowid)
    insertTemplateItems(db, taskId, categoryId)
    recordEvent(db, { taskId, actorId: actor.id, type: "created", to: "todo", detail: { assigneeId }, at: timestamp })
    return taskId
  })

  return getTaskDetail(db, id)
}

const FIELD_COLUMNS = {
  title: "title",
  description: "description",
  priority: "priority",
  dueDate: "due_date",
} as const

export function updateTask(db: Db, actor: Actor, id: number, patch: UpdateTaskInput): TaskDetailDTO {
  const row = getTaskRow(db, id)

  transaction(db, () => {
    const timestamp = now()
    const changed: string[] = []

    for (const [field, column] of Object.entries(FIELD_COLUMNS) as [keyof typeof FIELD_COLUMNS, string][]) {
      const value = patch[field]
      const current = field === "dueDate" ? row.due_date : row[field]
      if (value !== undefined && value !== current) {
        db.prepare(`UPDATE tasks SET ${column} = ? WHERE id = ?`).run(value, id)
        changed.push(field)
      }
    }

    if (patch.category !== undefined && patch.category !== row.category_key) {
      assertRule(checkChecklistEditable(row.status))
      // Troca os itens do padrão antigo pelos do novo; itens avulsos ficam.
      const categoryId = getCategoryId(db, patch.category)
      db.prepare("DELETE FROM checklist_items WHERE task_id = ? AND is_from_template = 1").run(id)
      const templateSize = getTemplate(db, categoryId).length
      db.prepare("UPDATE checklist_items SET position = position + ? WHERE task_id = ?").run(templateSize, id)
      insertTemplateItems(db, id, categoryId)
      db.prepare("UPDATE tasks SET category_id = ? WHERE id = ?").run(categoryId, id)
      changed.push("category")
    }

    if (patch.assigneeId !== undefined && patch.assigneeId !== row.assignee_id) {
      ensureAssignable(db, actor, patch.assigneeId)
      db.prepare("UPDATE tasks SET assignee_id = ? WHERE id = ?").run(patch.assigneeId, id)
      recordEvent(db, {
        taskId: id,
        actorId: actor.id,
        type: "assigned",
        detail: { from: row.assignee_id, to: patch.assigneeId },
        at: timestamp,
      })
    }

    if (changed.length > 0) {
      recordEvent(db, { taskId: id, actorId: actor.id, type: "updated", detail: { fields: changed }, at: timestamp })
    }
    db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").run(timestamp, id)
  })

  return getTaskDetail(db, id)
}

export function moveTask(db: Db, actor: Actor, id: number, input: MoveTaskInput): TaskSummaryDTO {
  const row = getTaskRow(db, id)
  const reason = input.reason?.trim() || null

  const result = checkMove({
    from: row.status,
    to: input.status,
    actorRole: actor.role,
    checklistDone: row.checklist_done,
    checklistTotal: row.checklist_total,
    reason,
  })
  assertRule(result)

  transaction(db, () => {
    const timestamp = now()
    const sets: Record<string, unknown> = {
      status: input.status,
      position: positionFor(db, input.status, input.index, id),
    }

    switch (result.event) {
      case "approved":
        sets.completed_at = timestamp
        break
      case "reopened":
        sets.completed_at = null
        break
      case "blocked":
        sets.blocked_reason = reason
        sets.blocked_from_status = row.status
        break
      case "unblocked":
        sets.blocked_reason = null
        sets.blocked_from_status = null
        break
      case "returned":
        sets.last_return_reason = reason
        break
      case "sent_to_review":
        // O aviso de devolução some quando o card volta para a Revisão.
        sets.last_return_reason = null
        break
    }
    if (result.event) sets.updated_at = timestamp

    const columns = Object.keys(sets)
    db.prepare(`UPDATE tasks SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(
      ...(Object.values(sets) as (string | number | null)[]),
      id
    )

    if (result.event) {
      recordEvent(db, {
        taskId: id,
        actorId: actor.id,
        type: result.event,
        from: row.status,
        to: input.status,
        reason: result.event === "blocked" || result.event === "returned" ? reason : null,
        at: timestamp,
      })
    }
  })

  return getTaskSummary(db, id)
}

/* ───────────────────────── checklist ───────────────────────── */

function getChecklistRow(db: Db, taskId: number, itemId: number): ChecklistRow {
  const item = db
    .prepare("SELECT * FROM checklist_items WHERE id = ? AND task_id = ?")
    .get(itemId, taskId) as ChecklistRow | undefined
  if (!item) throw notFound("Item do checklist não encontrado.")
  return item
}

const touchTask = (db: Db, taskId: number) =>
  db.prepare("UPDATE tasks SET updated_at = ? WHERE id = ?").run(now(), taskId)

export function addChecklistItem(db: Db, taskId: number, input: CreateChecklistItemInput): ChecklistItemDTO {
  const task = getTaskRow(db, taskId)
  assertRule(checkChecklistEditable(task.status))

  const itemId = transaction(db, () => {
    const { next } = db
      .prepare("SELECT COALESCE(MAX(position), 0) + 1 AS next FROM checklist_items WHERE task_id = ?")
      .get(taskId) as { next: number }
    const result = db
      .prepare("INSERT INTO checklist_items (task_id, label, is_from_template, position) VALUES (?, ?, 0, ?)")
      .run(taskId, input.label, next)
    touchTask(db, taskId)
    return Number(result.lastInsertRowid)
  })
  return toChecklistItem(getChecklistRow(db, taskId, itemId))
}

export function updateChecklistItem(
  db: Db,
  actor: Actor,
  taskId: number,
  itemId: number,
  patch: UpdateChecklistItemInput
): ChecklistItemDTO {
  const task = getTaskRow(db, taskId)
  assertRule(checkChecklistEditable(task.status))
  const item = getChecklistRow(db, taskId, itemId)

  transaction(db, () => {
    if (patch.label !== undefined && patch.label !== item.label) {
      // Reescrever um item padrão equivale a removê-lo: mesma regra.
      assertRule(checkChecklistItemRemoval(actor.role, item.is_from_template === 1))
      db.prepare("UPDATE checklist_items SET label = ? WHERE id = ?").run(patch.label, itemId)
    }
    if (patch.isDone !== undefined && patch.isDone !== (item.is_done === 1)) {
      db.prepare("UPDATE checklist_items SET is_done = ?, done_by = ?, done_at = ? WHERE id = ?").run(
        patch.isDone ? 1 : 0,
        patch.isDone ? actor.id : null,
        patch.isDone ? now() : null,
        itemId
      )
    }
    touchTask(db, taskId)
  })
  return toChecklistItem(getChecklistRow(db, taskId, itemId))
}

export function removeChecklistItem(db: Db, actor: Actor, taskId: number, itemId: number) {
  const task = getTaskRow(db, taskId)
  assertRule(checkChecklistEditable(task.status))
  const item = getChecklistRow(db, taskId, itemId)
  assertRule(checkChecklistItemRemoval(actor.role, item.is_from_template === 1))

  transaction(db, () => {
    db.prepare("DELETE FROM checklist_items WHERE id = ?").run(itemId)
    touchTask(db, taskId)
  })
}
