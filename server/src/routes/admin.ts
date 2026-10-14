import { Router } from "express"
import {
  createCategorySchema,
  createUserSchema,
  reorderCategoriesSchema,
  settingsSchema,
  updateCategorySchema,
  updateUserSchema,
} from "@tarefas/shared"

import { currentUser, requireAdmin } from "../auth/middleware"
import { hashPassword } from "../auth/sessions"
import type { Db } from "../db/connection"
import { parseBody, parseId } from "../http/errors"
import { createCategory, deleteCategory, listCategories, reorderCategories, updateCategory } from "../services/categories"
import { updateSettings } from "../services/settings"
import { createUserAsAdmin, listAllUsers, resetPasswordAsAdmin, updateUserAsAdmin } from "../services/users"

/** Configurações: só para administradores. */
export function adminRoutes(db: Db) {
  const router = Router()
  router.use(requireAdmin)

  /* Usuários */
  router.get("/users", async (_req, res) => {
    res.json({ users: await listAllUsers(db) })
  })

  router.post("/users", async (req, res) => {
    const result = await createUserAsAdmin(db, parseBody(createUserSchema, req.body), hashPassword)
    res.status(201).json(result)
  })

  router.patch("/users/:id", async (req, res) => {
    const user = await updateUserAsAdmin(db, currentUser(res).id, parseId(req.params.id), parseBody(updateUserSchema, req.body))
    res.json({ user })
  })

  router.post("/users/:id/reset-password", async (req, res) => {
    const temporaryPassword = await resetPasswordAsAdmin(db, parseId(req.params.id), hashPassword)
    res.json({ temporaryPassword })
  })

  /* Categorias */
  router.get("/categories", async (_req, res) => {
    res.json({ categories: await listCategories(db, { withCounts: true }) })
  })

  router.post("/categories", async (req, res) => {
    res.status(201).json({ category: await createCategory(db, parseBody(createCategorySchema, req.body)) })
  })

  router.put("/categories/order", async (req, res) => {
    await reorderCategories(db, parseBody(reorderCategoriesSchema, req.body).keys)
    res.json({ categories: await listCategories(db, { withCounts: true }) })
  })

  router.patch("/categories/:key", async (req, res) => {
    res.json({ category: await updateCategory(db, String(req.params.key), parseBody(updateCategorySchema, req.body)) })
  })

  router.delete("/categories/:key", async (req, res) => {
    await deleteCategory(db, String(req.params.key))
    res.status(204).end()
  })

  /* Configurações gerais */
  router.patch("/settings", async (req, res) => {
    res.json({ settings: await updateSettings(db, parseBody(settingsSchema, req.body)) })
  })

  return router
}
