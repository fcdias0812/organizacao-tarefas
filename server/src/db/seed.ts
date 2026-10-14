/**
 * Popula o banco com usuários e tarefas de exemplo.
 *   npm run seed       → só se os usuários de exemplo ainda não existirem
 *   npm run db:reset   → APAGA todas as tarefas e os usuários de exemplo e recria tudo.
 *                        Contas reais (como a do administrador) são preservadas.
 */
import type { TaskEventType, TaskStatus } from "@tarefas/shared"

import { hashPassword } from "../auth/sessions"
import { config } from "../config"
import { getCategoryId, getTemplate } from "../services/categories"
import { recordEvent } from "../services/tasks"
import { insertUser } from "../services/users"
import { openDatabase, type Db } from "./connection"
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

const DEFAULT_CATEGORIES = [
  { key: "ticket", name: "Chamado", icon: "headset" },
  { key: "infra", name: "Infra", icon: "server" },
  { key: "purchase", name: "Compra", icon: "shopping-cart" },
  { key: "project", name: "Projeto", icon: "folder-kanban" },
  { key: "routine", name: "Rotina", icon: "refresh-cw" },
]

async function seed(db: Db, reset: boolean) {
  const demoEmails = Object.values(SEED_USERS).map((u) => u.email)
  const placeholders = demoEmails.map(() => "?").join(", ")
  const { n } = (await db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM users WHERE email IN (${placeholders})`,
    ...demoEmails
  ))!
  if (n > 0 && !reset) {
    console.log("Os dados de exemplo já existem. Para apagar e recriar, use: npm run db:reset")
    return
  }

  const passwordHash = await hashPassword(DEV_SEED_PASSWORD)

  await db.transaction(async (tx) => {
    if (reset) {
      await tx.exec("DELETE FROM task_comments; DELETE FROM task_events; DELETE FROM checklist_items; DELETE FROM tasks;")
      await tx.run(
        `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email IN (${placeholders}))`,
        ...demoEmails
      )
      await tx.run(`DELETE FROM users WHERE email IN (${placeholders})`, ...demoEmails)
    }

    // As tarefas de exemplo usam as categorias originais: recria as que faltarem.
    for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
      await tx.run(
        "INSERT INTO categories (key, name, icon, position, is_active) VALUES (?, ?, ?, ?, 1) ON CONFLICT (key) DO UPDATE SET is_active = 1",
        c.key,
        c.name,
        c.icon,
        i + 1
      )
    }

    const userIds = {} as Record<SeedUserKey, number>
    for (const [key, user] of Object.entries(SEED_USERS) as [SeedUserKey, (typeof SEED_USERS)[SeedUserKey]][]) {
      userIds[key] = await insertUser(tx, { ...user, passwordHash })
    }

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

      const categoryId = await getCategoryId(tx, task.category)
      const result = await tx.run(
        `INSERT INTO tasks (title, description, status, position, priority, due_date, category_id, assignee_id,
                            created_by, blocked_reason, blocked_from_status, last_return_reason,
                            created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      const taskId = result.lastInsertRowid

      const labels = [...(await getTemplate(tx, categoryId)), ...(task.extraItems ?? [])]
      const allChecked = task.status === "review" || task.status === "done"
      const checked = allChecked ? labels.length : Math.min(task.checked ?? 0, labels.length)
      const doer = userIds[task.assignee ?? task.createdBy]
      for (const [k, label] of labels.entries()) {
        const isDone = k < checked
        const isFromTemplate = k < labels.length - (task.extraItems?.length ?? 0)
        await tx.run(
          `INSERT INTO checklist_items (task_id, label, is_done, is_from_template, done_by, done_at, position)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          taskId,
          label,
          isDone ? 1 : 0,
          isFromTemplate ? 1 : 0,
          isDone ? doer : null,
          isDone ? lastAt : null,
          k + 1
        )
      }

      for (const [k, step] of steps.entries()) {
        await recordEvent(tx, {
          taskId,
          actorId: userIds[step.actor],
          type: step.type,
          from: step.from,
          to: step.to,
          reason: step.reason ?? null,
          detail: step.type === "created" ? { assigneeId: task.assignee ? userIds[task.assignee] : null } : null,
          at: stamp(k),
        })
      }
    }
  })

  console.log(`Pronto: ${Object.keys(SEED_USERS).length} usuários e ${SEED_TASKS.length} tarefas de exemplo.`)
  console.log("Logins: " + Object.values(SEED_USERS).map((u) => u.email).join(", "))
  console.log("A senha de todos está em server/.env.example (SEED_PASSWORD).")
}

const db = await openDatabase(config.db)
await seed(db, process.argv.includes("--reset"))
db.close()
