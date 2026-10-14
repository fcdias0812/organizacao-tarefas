import { Router, type Response } from "express"
import {
  commentSchema,
  createChecklistItemSchema,
  createTaskSchema,
  moveTaskSchema,
  updateChecklistItemSchema,
  updateTaskSchema,
  type AuditArea,
} from "@tarefas/shared"

import { currentUser } from "../auth/middleware"
import type { Db } from "../db/connection"
import { parseBody, parseId } from "../http/errors"
import {
  auditContext,
  describeNewTask,
  describeTaskChanges,
  joinParts,
  quote,
  recordAudit,
  taskRef,
} from "../services/audit"
import { addComment, deleteComment, updateComment } from "../services/comments"
import {
  addChecklistItem,
  archiveTask,
  createTask,
  deleteTaskPermanently,
  getTaskDetail,
  getTaskSummary,
  listArchivedTasks,
  listTasks,
  moveTask,
  removeChecklistItem,
  restoreTask,
  updateChecklistItem,
  updateTask,
} from "../services/tasks"

export function taskRoutes(db: Db) {
  const router = Router()

  /** Registra a ação na auditoria (depois que ela deu certo). */
  const audit = (res: Response, area: AuditArea, action: string, taskId: number, summary: string) =>
    recordAudit(db, { actorId: currentUser(res).id, area, action, taskId, summary })

  router.get("/", async (_req, res) => {
    res.json({ tasks: await listTasks(db) })
  })

  router.get("/archived", async (_req, res) => {
    res.json({ tasks: await listArchivedTasks(db) })
  })

  router.post("/", async (req, res) => {
    const task = await createTask(db, currentUser(res), parseBody(createTaskSchema, req.body))
    await audit(res, "tasks", "task.created", task.id, `criou a tarefa ${taskRef(task)} — ${describeNewTask(task, await auditContext(db))}`)
    res.status(201).json({ task })
  })

  router.get("/:id", async (req, res) => {
    res.json({ task: await getTaskDetail(db, parseId(req.params.id)) })
  })

  router.patch("/:id", async (req, res) => {
    const id = parseId(req.params.id)
    const before = await getTaskSummary(db, id)
    const task = await updateTask(db, currentUser(res), id, parseBody(updateTaskSchema, req.body))
    const changes = describeTaskChanges(before, task, await auditContext(db))
    if (changes.length > 0) await audit(res, "tasks", "task.updated", id, `editou a tarefa ${taskRef(task)}: ${joinParts(changes)}`)
    res.json({ task })
  })

  /** Muda de coluna e/ou de posição. Bloquear e devolver exigem `reason`. */
  router.post("/:id/move", async (req, res) => {
    const id = parseId(req.params.id)
    const before = await getTaskSummary(db, id)
    const input = parseBody(moveTaskSchema, req.body)
    const task = await moveTask(db, currentUser(res), id, input)
    // Só mudar a ordem dentro da mesma coluna não entra na auditoria.
    if (before.status !== task.status) {
      const ctx = await auditContext(db)
      const reason = input.reason?.trim() ? ` — motivo: ${quote(input.reason.trim())}` : ""
      await audit(
        res,
        "tasks",
        "task.moved",
        id,
        `moveu a tarefa ${taskRef(task)} de ${ctx.status(before.status)} para ${ctx.status(task.status)}${reason}`
      )
    }
    res.json({ task })
  })

  router.post("/:id/archive", async (req, res) => {
    const task = await archiveTask(db, currentUser(res), parseId(req.params.id))
    await audit(res, "tasks", "task.archived", task.id, `arquivou a tarefa ${taskRef(task)}`)
    res.json({ task })
  })

  router.post("/:id/restore", async (req, res) => {
    const task = await restoreTask(db, currentUser(res), parseId(req.params.id))
    await audit(res, "tasks", "task.restored", task.id, `restaurou a tarefa ${taskRef(task)}`)
    res.json({ task })
  })

  /** Excluir de vez: só administrador e só tarefa arquivada. */
  router.delete("/:id", async (req, res) => {
    const task = await deleteTaskPermanently(db, currentUser(res), parseId(req.params.id))
    await audit(res, "tasks", "task.deleted", task.id, `excluiu de vez a tarefa ${taskRef(task)} (com checklist, comentários e histórico)`)
    res.status(204).end()
  })

  router.post("/:id/checklist", async (req, res) => {
    const taskId = parseId(req.params.id)
    const item = await addChecklistItem(db, taskId, parseBody(createChecklistItemSchema, req.body))
    const task = await getTaskSummary(db, taskId)
    await audit(res, "checklist", "checklist.added", taskId, `adicionou o item ${quote(item.label)} ao checklist de ${taskRef(task)}`)
    res.status(201).json({ item })
  })

  router.patch("/:id/checklist/:itemId", async (req, res) => {
    const taskId = parseId(req.params.id)
    const before = (await getTaskDetail(db, taskId)).checklist.find((i) => i.id === parseId(req.params.itemId))
    const item = await updateChecklistItem(db, currentUser(res), taskId, parseId(req.params.itemId), parseBody(updateChecklistItemSchema, req.body))
    const task = await getTaskSummary(db, taskId)
    if (before && before.label !== item.label) {
      await audit(res, "checklist", "checklist.renamed", taskId, `renomeou o item ${quote(before.label)} para ${quote(item.label)} em ${taskRef(task)}`)
    }
    if (before && before.isDone !== item.isDone) {
      await audit(res, "checklist", item.isDone ? "checklist.checked" : "checklist.unchecked", taskId, `${item.isDone ? "marcou" : "desmarcou"} o item ${quote(item.label)} em ${taskRef(task)}`)
    }
    res.json({ item })
  })

  router.delete("/:id/checklist/:itemId", async (req, res) => {
    const taskId = parseId(req.params.id)
    const item = await removeChecklistItem(db, currentUser(res), taskId, parseId(req.params.itemId))
    const task = await getTaskSummary(db, taskId)
    await audit(res, "checklist", "checklist.removed", taskId, `removeu o item ${quote(item.label)} do checklist de ${taskRef(task)}`)
    res.status(204).end()
  })

  router.post("/:id/comments", async (req, res) => {
    const taskId = parseId(req.params.id)
    const comment = await addComment(db, currentUser(res), taskId, parseBody(commentSchema, req.body).body)
    const task = await getTaskSummary(db, taskId)
    await audit(res, "comments", "comment.added", taskId, `comentou em ${taskRef(task)}: ${quote(comment.body)}`)
    res.status(201).json({ comment })
  })

  router.patch("/:id/comments/:commentId", async (req, res) => {
    const taskId = parseId(req.params.id)
    const comment = await updateComment(db, currentUser(res), taskId, parseId(req.params.commentId), parseBody(commentSchema, req.body).body)
    const task = await getTaskSummary(db, taskId)
    await audit(res, "comments", "comment.edited", taskId, `editou um comentário em ${taskRef(task)}: ${quote(comment.body)}`)
    res.json({ comment })
  })

  router.delete("/:id/comments/:commentId", async (req, res) => {
    const taskId = parseId(req.params.id)
    const comment = await deleteComment(db, currentUser(res), taskId, parseId(req.params.commentId))
    const task = await getTaskSummary(db, taskId)
    await audit(res, "comments", "comment.deleted", taskId, `excluiu um comentário de ${taskRef(task)}: ${quote(comment.body)}`)
    res.status(204).end()
  })

  return router
}
