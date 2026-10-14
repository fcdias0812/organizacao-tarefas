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
  router.get("/users", (_req, res) => {
    res.json({ users: listAllUsers(db) })
  })

  router.post("/users", async (req, res) => {
    const result = await createUserAsAdmin(db, parseBody(createUserSchema, req.body), hashPassword)
    res.status(201).json(result)
  })

  router.patch("/users/:id", (req, res) => {
    const user = updateUserAsAdmin(db, currentUser(res).id, parseId(req.params.id), parseBody(updateUserSchema, req.body))
    res.json({ user })
  })

  router.post("/users/:id/reset-password", async (req, res) => {
    const temporaryPassword = await resetPasswordAsAdmin(db, parseId(req.params.id), hashPassword)
    res.json({ temporaryPassword })
  })

  /* Categorias */
  router.get("/categories", (_req, res) => {
    res.json({ categories: listCategories(db, { withCounts: true }) })
  })

  router.post("/categories", (req, res) => {
    res.status(201).json({ category: createCategory(db, parseBody(createCategorySchema, req.body)) })
  })

  router.put("/categories/order", (req, res) => {
    reorderCategories(db, parseBody(reorderCategoriesSchema, req.body).keys)
    res.json({ categories: listCategories(db, { withCounts: true }) })
  })

  router.patch("/categories/:key", (req, res) => {
    res.json({ category: updateCategory(db, String(req.params.key), parseBody(updateCategorySchema, req.body)) })
  })

  router.delete("/categories/:key", (req, res) => {
    deleteCategory(db, String(req.params.key))
    res.status(204).end()
  })

  /* Configurações gerais */
  router.patch("/settings", (req, res) => {
    res.json({ settings: updateSettings(db, parseBody(settingsSchema, req.body)) })
  })

  return router
}
