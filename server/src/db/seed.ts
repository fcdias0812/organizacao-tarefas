/**
 * Popula o banco com usuários e tarefas de exemplo.
 *   npm run seed       → só se o banco estiver vazio
 *   npm run db:reset   → APAGA usuários, tarefas e histórico e recria tudo
 */
import type { TaskEventType, TaskStatus } from "@tarefas/shared"

import { hashPassword } from "../auth/sessions"
import { config } from "../config"
import { getCategoryId, getTemplate } from "../services/categories"
import { recordEvent } from "../services/tasks"
import { insertUser } from "../services/users"
import { openDatabase, transaction, type Db } from "./connection"
import { DEV_SEED_PASSWORD, SEED_TASKS, SEED_USERS, type SeedTask, type SeedUserKey } from "./seed-data"

const DAY = 24 * 60 * 60 * 1000

/** Data local (AAAA-MM-DD) daqui a `days` dias. Não usa toISOString, que é UTC. */
function daysFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, "0")).join("-")
}

interface Step {
  type: TaskEventType
  actor: SeedUserKey
  from: TaskStatus | null
  to: TaskStatus | null
  reason?: string
}

/** Monta o histórico coerente com o status final do card. */
function historyFor(task: SeedTask): Step[] {
  const doer = task.assignee ?? task.createdBy
  const approver = task.approvedBy ?? "marcos"
  const steps: Step[] = [{ type: "created", actor: task.createdBy, from: null, to: "todo" }]
  if (task.status === "todo") return steps

  steps.push({ type: "moved", actor: doer, from: "todo", to: "in_progress" })

  if (task.returnReason) {
    steps.push({ type: "sent_to_review", actor: doer, from: "in_progress", to: "review" })
    steps.push({ type: "returned", actor: approver, from: "review", to: "in_progress", reason: task.returnReason })
  }
  if (task.status === "review" || task.status === "done") {
    steps.push({ type: "sent_to_review", actor: doer, from: "in_progress", to: "review" })
  }
  if (task.status === "done") {
    steps.push({ type: "approved", actor: approver, from: "review", to: "done" })
  }
  if (task.status === "blocked") {
    steps.push({ type: "blocked", actor: doer, from: "in_progress", to: "blocked", reason: task.blockedReason })
  }
  return steps
}

async function seed(db: Db, reset: boolean) {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }
  if (n > 0 && !reset) {
    console.log("O banco já tem dados. Para apagar tudo e recriar, use: npm run db:reset")
    return
  }

  const passwordHash = await hashPassword(DEV_SEED_PASSWORD)

  transaction(db, () => {
    if (reset) {
      db.exec("DELETE FROM task_events; DELETE FROM checklist_items; DELETE FROM tasks; DELETE FROM sessions; DELETE FROM users;")
    }

    const userIds = {} as Record<SeedUserKey, number>
    for (const [key, user] of Object.entries(SEED_USERS) as [SeedUserKey, (typeof SEED_USERS)[SeedUserKey]][]) {
      userIds[key] = insertUser(db, { ...user, passwordHash })
    }

    const insertTask = db.prepare(
      `INSERT INTO tasks (title, description, status, position, priority, due_date, category_id, assignee_id,
                          created_by, blocked_reason, blocked_from_status, last_return_reason,
                          created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const insertItem = db.prepare(
      `INSERT INTO checklist_items (task_id, label, is_done, is_from_template, done_by, done_at, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const positionInColumn = new Map<TaskStatus, number>()

    for (const task of SEED_TASKS) {
      const steps = historyFor(task)
      const createdAt = Date.now() - task.createdDaysAgo * DAY - 3 * 60 * 60 * 1000
      // Eventos espalhados entre a criação e agora.
      const span = Date.now() - createdAt
      const stamp = (k: number) => new Date(createdAt + (span * k) / (steps.length + 0.5)).toISOString()
      const lastAt = stamp(steps.length - 1)

      const position = (positionInColumn.get(task.status) ?? 0) + 1024
      positionInColumn.set(task.status, position)

      const categoryId = getCategoryId(db, task.category)
      const result = insertTask.run(
        task.title,
        task.description,
        task.status,
        position,
        task.priority,
        task.due === null ? null : daysFromToday(task.due),
        categoryId,
        task.assignee ? userIds[task.assignee] : null,
        userIds[task.createdBy],
        task.blockedReason ?? null,
        task.status === "blocked" ? "in_progress" : null,
        task.returnReason ?? null,
        stamp(0),
        lastAt,
        task.status === "done" ? lastAt : null
      )
      const taskId = Number(result.lastInsertRowid)

      const labels = [...getTemplate(db, categoryId), ...(task.extraItems ?? [])]
      const allChecked = task.status === "review" || task.status === "done"
      const checked = allChecked ? labels.length : Math.min(task.checked ?? 0, labels.length)
      const doer = userIds[task.assignee ?? task.createdBy]
      labels.forEach((label, k) => {
        const isDone = k < checked
        const isFromTemplate = k < labels.length - (task.extraItems?.length ?? 0)
        insertItem.run(taskId, label, isDone ? 1 : 0, isFromTemplate ? 1 : 0, isDone ? doer : null, isDone ? lastAt : null, k + 1)
      })

      steps.forEach((step, k) =>
        recordEvent(db, {
          taskId,
          actorId: userIds[step.actor],
          type: step.type,
          from: step.from,
          to: step.to,
          reason: step.reason ?? null,
          detail: step.type === "created" ? { assigneeId: task.assignee ? userIds[task.assignee] : null } : null,
          at: stamp(k),
        })
      )
    }
  })

  console.log(`Pronto: ${Object.keys(SEED_USERS).length} usuários e ${SEED_TASKS.length} tarefas de exemplo.`)
  console.log("Logins: " + Object.values(SEED_USERS).map((u) => u.email).join(", "))
  console.log("A senha de todos está em server/.env.example (SEED_PASSWORD).")
}

const db = openDatabase(config.dbPath)
await seed(db, process.argv.includes("--reset"))
db.close()
