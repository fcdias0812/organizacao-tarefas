import { Router, type Response } from "express"
import {
  createCategorySchema,
  createUserSchema,
  reorderCategoriesSchema,
  settingsSchema,
  updateCategorySchema,
  updateUserSchema,
  type AuditArea,
} from "@tarefas/shared"

import { currentUser, requireAdmin } from "../auth/middleware"
import { hashPassword } from "../auth/sessions"
import type { Db } from "../db/connection"
import { notFound, parseBody, parseId } from "../http/errors"
import {
  describeCategoryChanges,
  describeNewUser,
  describeSettingsChanges,
  describeUserChanges,
  joinParts,
  quote,
  recordAudit,
} from "../services/audit"
import { createCategory, deleteCategory, listCategories, reorderCategories, updateCategory } from "../services/categories"
import { getSettings, updateSettings } from "../services/settings"
import { createUserAsAdmin, getAdminUser, listAllUsers, resetPasswordAsAdmin, updateUserAsAdmin } from "../services/users"

/** Configurações: só para administradores. */
export function adminRoutes(db: Db) {
  const router = Router()
  router.use(requireAdmin)

  /** Registra a ação na auditoria (depois que ela deu certo). Senhas nunca entram no texto. */
  const audit = (res: Response, area: AuditArea, action: string, summary: string) =>
    recordAudit(db, { actorId: currentUser(res).id, area, action, summary })

  const findCategory = async (key: string) => {
    const category = (await listCategories(db)).find((c) => c.key === key)
    if (!category) throw notFound("Categoria não encontrada.")
    return category
  }

  /* Usuários */
  router.get("/users", async (_req, res) => {
    res.json({ users: await listAllUsers(db) })
  })

  router.post("/users", async (req, res) => {
    const result = await createUserAsAdmin(db, parseBody(createUserSchema, req.body), hashPassword)
    await audit(res, "users", "user.created", describeNewUser(result.user))
    res.status(201).json(result)
  })

  router.patch("/users/:id", async (req, res) => {
    const id = parseId(req.params.id)
    const before = await getAdminUser(db, id)
    const user = await updateUserAsAdmin(db, currentUser(res).id, id, parseBody(updateUserSchema, req.body))
    const changes = describeUserChanges(before, user)
    if (changes.length > 0) await audit(res, "users", "user.updated", `editou o usuário ${user.name}: ${joinParts(changes)}`)
    res.json({ user })
  })

  router.post("/users/:id/reset-password", async (req, res) => {
    const id = parseId(req.params.id)
    const temporaryPassword = await resetPasswordAsAdmin(db, id, hashPassword)
    const user = await getAdminUser(db, id)
    await audit(res, "users", "user.password_reset", `gerou uma nova senha para ${user.name} (as sessões abertas dessa pessoa foram encerradas)`)
    res.json({ temporaryPassword })
  })

  /* Categorias */
  router.get("/categories", async (_req, res) => {
    res.json({ categories: await listCategories(db, { withCounts: true }) })
  })

  router.post("/categories", async (req, res) => {
    const category = await createCategory(db, parseBody(createCategorySchema, req.body))
    const items = category.checklistTemplate.length
    await audit(res, "categories", "category.created", `criou a categoria ${quote(category.name)} com ${items === 1 ? "1 item" : `${items} itens`} no checklist padrão`)
    res.status(201).json({ category })
  })

  router.put("/categories/order", async (req, res) => {
    await reorderCategories(db, parseBody(reorderCategoriesSchema, req.body).keys)
    const categories = await listCategories(db, { withCounts: true })
    await audit(res, "categories", "category.reordered", `reordenou as categorias: ${categories.map((c) => c.name).join(", ")}`)
    res.json({ categories })
  })

  router.patch("/categories/:key", async (req, res) => {
    const key = String(req.params.key)
    const before = await findCategory(key)
    const category = await updateCategory(db, key, parseBody(updateCategorySchema, req.body))
    const changes = describeCategoryChanges(before, category)
    if (changes.length > 0) await audit(res, "categories", "category.updated", `editou a categoria ${quote(category.name)}: ${joinParts(changes)}`)
    res.json({ category })
  })

  router.delete("/categories/:key", async (req, res) => {
    const key = String(req.params.key)
    const before = await findCategory(key)
    await deleteCategory(db, key)
    await audit(res, "categories", "category.deleted", `excluiu a categoria ${quote(before.name)}`)
    res.status(204).end()
  })

  /* Configurações gerais */
  router.patch("/settings", async (req, res) => {
    const before = await getSettings(db)
    const settings = await updateSettings(db, parseBody(settingsSchema, req.body))
    const changes = describeSettingsChanges(before, settings)
    if (changes.length > 0) await audit(res, "settings", "settings.updated", `alterou as configurações: ${joinParts(changes)}`)
    res.json({ settings })
  })

  return router
}
