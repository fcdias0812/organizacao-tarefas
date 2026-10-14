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

import type { Db, SqlValue } from "../db/connection"
import { assertRule, HttpError, notFound } from "../http/errors"
import { getCategoryId, getTemplate } from "./categories"
import { listComments } from "./comments"
import { ruleOptions } from "./settings"
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
  comment_count: number
}

const TASK_SELECT = `
  SELECT t.*, c.key AS category_key,
    (SELECT COUNT(*) FROM checklist_items i WHERE i.task_id = t.id) AS checklist_total,
    (SELECT COUNT(*) FROM checklist_items i WHERE i.task_id = t.id AND i.is_done = 1) AS checklist_done,
    (SELECT COUNT(*) FROM task_comments m WHERE m.task_id = t.id) AS comment_count
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
    commentCount: row.comment_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  }
}

async function getTaskRow(db: Db, id: number): Promise<TaskRow> {
  const row = await db.get<TaskRow>(`${TASK_SELECT} WHERE t.id = ?`, id)
  if (!row) throw notFound("Tarefa não encontrada.")
  return row
}

export async function listTasks(db: Db): Promise<TaskSummaryDTO[]> {
  return (await db.all<TaskRow>(`${TASK_SELECT} ORDER BY t.status, t.position`)).map(toSummary)
}

export async function getTaskSummary(db: Db, id: number): Promise<TaskSummaryDTO> {
  return toSummary(await getTaskRow(db, id))
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

export async function getTaskDetail(db: Db, id: number): Promise<TaskDetailDTO> {
  const row = await getTaskRow(db, id)
  const [checklist, events, comments] = await Promise.all([
    db.all<ChecklistRow>("SELECT * FROM checklist_items WHERE task_id = ? ORDER BY position, id", id),
    db.all<EventRow>("SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at, id", id),
    listComments(db, id),
  ])

  return {
    ...toSummary(row),
    checklist: checklist.map(toChecklistItem),
    events: events.map(toEvent),
    comments,
  }
}

/* ───────────────────────── apoio ───────────────────────── */

const now = () => new Date().toISOString()

export async function recordEvent(
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
  await db.run(
    `INSERT INTO task_events (task_id, actor_id, type, from_status, to_status, reason, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
export async function positionFor(db: Db, status: TaskStatus, index: number | undefined, excludeId = 0): Promise<number> {
  const rows = await db.all<{ id: number; position: number }>(
    "SELECT id, position FROM tasks WHERE status = ? AND id != ? ORDER BY position",
    status,
    excludeId
  )

  const position = positionBetween(
    rows.map((r) => r.position),
    index
  )
  if (position !== null) return position

  // Sem espaço entre os vizinhos: renumera a coluna e tenta de novo.
  for (const [k, r] of rows.entries()) await db.run("UPDATE tasks SET position = ? WHERE id = ?", (k + 1) * POSITION_STEP, r.id)
  return positionFor(db, status, index, excludeId)
}

async function ensureAssignable(db: Db, actor: Actor, assigneeId: number | null) {
  assertRule(checkAssign(actor, assigneeId))
  if (assigneeId !== null && !(await findUserById(db, assigneeId))) {
    throw new HttpError(422, "validation_error", "Responsável não encontrado.")
  }
}

async function insertTemplateItems(db: Db, taskId: number, categoryId: number, startPosition = 1) {
  for (const [k, label] of (await getTemplate(db, categoryId)).entries()) {
    await db.run(
      "INSERT INTO checklist_items (task_id, label, is_from_template, position) VALUES (?, ?, 1, ?)",
      taskId,
      label,
      startPosition + k
    )
  }
}

/* ───────────────────────── escrita ───────────────────────── */

export async function createTask(db: Db, actor: Actor, input: CreateTaskInput): Promise<TaskDetailDTO> {
  const assigneeId = input.assigneeId === undefined ? actor.id : input.assigneeId
  await ensureAssignable(db, actor, assigneeId)

  const id = await db.transaction(async (tx) => {
    const categoryId = await getCategoryId(tx, input.category, { mustBeActive: true })
    const timestamp = now()
    const result = await tx.run(
      `INSERT INTO tasks (title, description, status, position, priority, due_date, category_id,
                          assignee_id, created_by, created_at, updated_at)
       VALUES (?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.title,
      input.description,
      await positionFor(tx, "todo", 0),
      input.priority,
      input.dueDate,
      categoryId,
      assigneeId,
      actor.id,
      timestamp,
      timestamp
    )
    const taskId = result.lastInsertRowid
    await insertTemplateItems(tx, taskId, categoryId)
    await recordEvent(tx, { taskId, actorId: actor.id, type: "created", to: "todo", detail: { assigneeId }, at: timestamp })
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

export async function updateTask(db: Db, actor: Actor, id: number, patch: UpdateTaskInput): Promise<TaskDetailDTO> {
  const row = await getTaskRow(db, id)

  await db.transaction(async (tx) => {
    const timestamp = now()
    const changed: string[] = []

    for (const [field, column] of Object.entries(FIELD_COLUMNS) as [keyof typeof FIELD_COLUMNS, string][]) {
      const value = patch[field]
      const current = field === "dueDate" ? row.due_date : row[field]
      if (value !== undefined && value !== current) {
        await tx.run(`UPDATE tasks SET ${column} = ? WHERE id = ?`, value, id)
        changed.push(field)
      }
    }

    if (patch.category !== undefined && patch.category !== row.category_key) {
      assertRule(checkChecklistEditable(row.status, await ruleOptions(tx)))
      // Troca os itens do padrão antigo pelos do novo; itens avulsos ficam.
      const categoryId = await getCategoryId(tx, patch.category, { mustBeActive: true })
      await tx.run("DELETE FROM checklist_items WHERE task_id = ? AND is_from_template = 1", id)
      const templateSize = (await getTemplate(tx, categoryId)).length
      await tx.run("UPDATE checklist_items SET position = position + ? WHERE task_id = ?", templateSize, id)
      await insertTemplateItems(tx, id, categoryId)
      await tx.run("UPDATE tasks SET category_id = ? WHERE id = ?", categoryId, id)
      changed.push("category")
    }

    if (patch.assigneeId !== undefined && patch.assigneeId !== row.assignee_id) {
      await ensureAssignable(tx, actor, patch.assigneeId)
      await tx.run("UPDATE tasks SET assignee_id = ? WHERE id = ?", patch.assigneeId, id)
      await recordEvent(tx, {
        taskId: id,
        actorId: actor.id,
        type: "assigned",
        detail: { from: row.assignee_id, to: patch.assigneeId },
        at: timestamp,
      })
    }

    if (changed.length > 0) {
      await recordEvent(tx, { taskId: id, actorId: actor.id, type: "updated", detail: { fields: changed }, at: timestamp })
    }
    await tx.run("UPDATE tasks SET updated_at = ? WHERE id = ?", timestamp, id)
  })

  return getTaskDetail(db, id)
}

export async function moveTask(db: Db, actor: Actor, id: number, input: MoveTaskInput): Promise<TaskSummaryDTO> {
  const row = await getTaskRow(db, id)
  const reason = input.reason?.trim() || null

  const result = checkMove(
    {
      from: row.status,
      to: input.status,
      actorRole: actor.role,
      checklistDone: row.checklist_done,
      checklistTotal: row.checklist_total,
      reason,
    },
    await ruleOptions(db)
  )
  assertRule(result)

  await db.transaction(async (tx) => {
    const timestamp = now()
    const sets: Record<string, SqlValue> = {
      status: input.status,
      position: await positionFor(tx, input.status, input.index, id),
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
    await tx.run(`UPDATE tasks SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`, ...Object.values(sets), id)

    if (result.event) {
      await recordEvent(tx, {
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

async function getChecklistRow(db: Db, taskId: number, itemId: number): Promise<ChecklistRow> {
  const item = await db.get<ChecklistRow>("SELECT * FROM checklist_items WHERE id = ? AND task_id = ?", itemId, taskId)
  if (!item) throw notFound("Item do checklist não encontrado.")
  return item
}

const touchTask = (db: Db, taskId: number) => db.run("UPDATE tasks SET updated_at = ? WHERE id = ?", now(), taskId)

export async function addChecklistItem(db: Db, taskId: number, input: CreateChecklistItemInput): Promise<ChecklistItemDTO> {
  const task = await getTaskRow(db, taskId)
  assertRule(checkChecklistEditable(task.status, await ruleOptions(db)))

  const itemId = await db.transaction(async (tx) => {
    const { next } = (await tx.get<{ next: number }>(
      "SELECT COALESCE(MAX(position), 0) + 1 AS next FROM checklist_items WHERE task_id = ?",
      taskId
    ))!
    const result = await tx.run(
      "INSERT INTO checklist_items (task_id, label, is_from_template, position) VALUES (?, ?, 0, ?)",
      taskId,
      input.label,
      next
    )
    await touchTask(tx, taskId)
    return result.lastInsertRowid
  })
  return toChecklistItem(await getChecklistRow(db, taskId, itemId))
}

export async function updateChecklistItem(
  db: Db,
  actor: Actor,
  taskId: number,
  itemId: number,
  patch: UpdateChecklistItemInput
): Promise<ChecklistItemDTO> {
  const task = await getTaskRow(db, taskId)
  assertRule(checkChecklistEditable(task.status, await ruleOptions(db)))
  const item = await getChecklistRow(db, taskId, itemId)

  await db.transaction(async (tx) => {
    if (patch.label !== undefined && patch.label !== item.label) {
      // Reescrever um item padrão equivale a removê-lo: mesma regra.
      assertRule(checkChecklistItemRemoval(actor.role, item.is_from_template === 1))
      await tx.run("UPDATE checklist_items SET label = ? WHERE id = ?", patch.label, itemId)
    }
    if (patch.isDone !== undefined && patch.isDone !== (item.is_done === 1)) {
      await tx.run(
        "UPDATE checklist_items SET is_done = ?, done_by = ?, done_at = ? WHERE id = ?",
        patch.isDone ? 1 : 0,
        patch.isDone ? actor.id : null,
        patch.isDone ? now() : null,
        itemId
      )
    }
    await touchTask(tx, taskId)
  })
  return toChecklistItem(await getChecklistRow(db, taskId, itemId))
}

export async function removeChecklistItem(db: Db, actor: Actor, taskId: number, itemId: number) {
  const task = await getTaskRow(db, taskId)
  assertRule(checkChecklistEditable(task.status, await ruleOptions(db)))
  const item = await getChecklistRow(db, taskId, itemId)
  assertRule(checkChecklistItemRemoval(actor.role, item.is_from_template === 1))

  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM checklist_items WHERE id = ?", itemId)
    await touchTask(tx, taskId)
  })
}
