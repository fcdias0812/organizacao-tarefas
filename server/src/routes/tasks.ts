import { Router } from "express"
import {
  commentSchema,
  createChecklistItemSchema,
  createTaskSchema,
  moveTaskSchema,
  updateChecklistItemSchema,
  updateTaskSchema,
} from "@tarefas/shared"

import { currentUser } from "../auth/middleware"
import type { Db } from "../db/connection"
import { parseBody, parseId } from "../http/errors"
import { addComment, deleteComment, updateComment } from "../services/comments"
import {
  addChecklistItem,
  createTask,
  getTaskDetail,
  listTasks,
  moveTask,
  removeChecklistItem,
  updateChecklistItem,
  updateTask,
} from "../services/tasks"

export function taskRoutes(db: Db) {
  const router = Router()

  router.get("/", async (_req, res) => {
    res.json({ tasks: await listTasks(db) })
  })

  router.post("/", async (req, res) => {
    const task = await createTask(db, currentUser(res), parseBody(createTaskSchema, req.body))
    res.status(201).json({ task })
  })

  router.get("/:id", async (req, res) => {
    res.json({ task: await getTaskDetail(db, parseId(req.params.id)) })
  })

  router.patch("/:id", async (req, res) => {
    const task = await updateTask(db, currentUser(res), parseId(req.params.id), parseBody(updateTaskSchema, req.body))
    res.json({ task })
  })

  /** Muda de coluna e/ou de posição. Bloquear e devolver exigem `reason`. */
  router.post("/:id/move", async (req, res) => {
    const task = await moveTask(db, currentUser(res), parseId(req.params.id), parseBody(moveTaskSchema, req.body))
    res.json({ task })
  })

  router.post("/:id/checklist", async (req, res) => {
    const item = await addChecklistItem(db, parseId(req.params.id), parseBody(createChecklistItemSchema, req.body))
    res.status(201).json({ item })
  })

  router.patch("/:id/checklist/:itemId", async (req, res) => {
    const item = await updateChecklistItem(
      db,
      currentUser(res),
      parseId(req.params.id),
      parseId(req.params.itemId),
      parseBody(updateChecklistItemSchema, req.body)
    )
    res.json({ item })
  })

  router.delete("/:id/checklist/:itemId", async (req, res) => {
    await removeChecklistItem(db, currentUser(res), parseId(req.params.id), parseId(req.params.itemId))
    res.status(204).end()
  })

  router.post("/:id/comments", async (req, res) => {
    const comment = await addComment(db, currentUser(res), parseId(req.params.id), parseBody(commentSchema, req.body).body)
    res.status(201).json({ comment })
  })

  router.patch("/:id/comments/:commentId", async (req, res) => {
    const comment = await updateComment(
      db,
      currentUser(res),
      parseId(req.params.id),
      parseId(req.params.commentId),
      parseBody(commentSchema, req.body).body
    )
    res.json({ comment })
  })

  router.delete("/:id/comments/:commentId", async (req, res) => {
    await deleteComment(db, currentUser(res), parseId(req.params.id), parseId(req.params.commentId))
    res.status(204).end()
  })

  return router
}
