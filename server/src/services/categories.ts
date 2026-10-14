import type { CategoryDTO, CategoryKey, CreateCategoryInput, UpdateCategoryInput } from "@tarefas/shared"

import type { Db } from "../db/connection"
import { HttpError, notFound } from "../http/errors"

interface CategoryRow {
  id: number
  key: string
  name: string
  icon: string
  is_active: number
  position: number
  task_count?: number
}

export async function getTemplate(db: Db, categoryId: number): Promise<string[]> {
  const rows = await db.all<{ label: string }>(
    "SELECT label FROM category_checklist_templates WHERE category_id = ? ORDER BY position",
    categoryId
  )
  return rows.map((r) => r.label)
}

const toDTO = async (db: Db, row: CategoryRow, withCount: boolean): Promise<CategoryDTO> => ({
  key: row.key,
  name: row.name,
  icon: row.icon,
  isActive: row.is_active === 1,
  position: row.position,
  checklistTemplate: await getTemplate(db, row.id),
  ...(withCount ? { taskCount: row.task_count ?? 0 } : {}),
})

/** Todas as categorias (as desativadas também, para exibir tarefas antigas). */
export async function listCategories(db: Db, options: { withCounts?: boolean } = {}): Promise<CategoryDTO[]> {
  const rows = await db.all<CategoryRow>(
    `SELECT c.*, (SELECT COUNT(*) FROM tasks t WHERE t.category_id = c.id) AS task_count
     FROM categories c ORDER BY c.position, c.id`
  )
  return Promise.all(rows.map((r) => toDTO(db, r, options.withCounts ?? false)))
}

async function getRow(db: Db, key: CategoryKey): Promise<CategoryRow> {
  const row = await db.get<CategoryRow>("SELECT * FROM categories WHERE key = ?", key)
  if (!row) throw notFound("Categoria não encontrada.")
  return row
}

/** Id da categoria para gravar numa tarefa. Novas tarefas só usam categorias ativas. */
export async function getCategoryId(db: Db, key: CategoryKey, options: { mustBeActive?: boolean } = {}): Promise<number> {
  const row = await db.get<{ id: number; is_active: number }>("SELECT id, is_active FROM categories WHERE key = ?", key)
  if (!row) throw new HttpError(422, "validation_error", "Categoria inválida.")
  if (options.mustBeActive && row.is_active !== 1) {
    throw new HttpError(422, "validation_error", "Essa categoria está desativada.")
  }
  return row.id
}

function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "categoria"
  )
}

async function replaceTemplate(db: Db, categoryId: number, items: string[]) {
  await db.run("DELETE FROM category_checklist_templates WHERE category_id = ?", categoryId)
  for (const [i, label] of items.entries()) {
    await db.run(
      "INSERT INTO category_checklist_templates (category_id, label, position) VALUES (?, ?, ?)",
      categoryId,
      label,
      i + 1
    )
  }
}

async function ensureUniqueName(db: Db, name: string, exceptId = 0) {
  const clash = await db.get("SELECT 1 FROM categories WHERE lower(name) = lower(?) AND id != ?", name, exceptId)
  if (clash) throw new HttpError(409, "conflict", `Já existe uma categoria chamada "${name}".`)
}

export async function createCategory(db: Db, input: CreateCategoryInput): Promise<CategoryDTO> {
  await ensureUniqueName(db, input.name)
  const key = await db.transaction(async (tx) => {
    const base = slugify(input.name)
    let key = base
    for (let n = 2; await tx.get("SELECT 1 FROM categories WHERE key = ?", key); n++) key = `${base}-${n}`
    const { next } = (await tx.get<{ next: number }>("SELECT COALESCE(MAX(position), 0) + 1 AS next FROM categories"))!
    const result = await tx.run(
      "INSERT INTO categories (key, name, icon, position, is_active) VALUES (?, ?, ?, ?, 1)",
      key,
      input.name,
      input.icon,
      next
    )
    await replaceTemplate(tx, result.lastInsertRowid, input.checklistTemplate)
    return key
  })
  return toDTO(db, await getRow(db, key), true)
}

export async function updateCategory(db: Db, key: CategoryKey, patch: UpdateCategoryInput): Promise<CategoryDTO> {
  const row = await getRow(db, key)
  if (patch.name !== undefined) await ensureUniqueName(db, patch.name, row.id)
  if (patch.isActive === false) {
    const { n } = (await db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM categories WHERE is_active = 1 AND id != ?",
      row.id
    ))!
    if (n === 0) throw new HttpError(409, "conflict", "Mantenha pelo menos uma categoria ativa.")
  }

  await db.transaction(async (tx) => {
    if (patch.name !== undefined) await tx.run("UPDATE categories SET name = ? WHERE id = ?", patch.name, row.id)
    if (patch.icon !== undefined) await tx.run("UPDATE categories SET icon = ? WHERE id = ?", patch.icon, row.id)
    if (patch.isActive !== undefined) {
      await tx.run("UPDATE categories SET is_active = ? WHERE id = ?", patch.isActive ? 1 : 0, row.id)
    }
    // O modelo vale para tarefas novas; as existentes mantêm o checklist que já têm.
    if (patch.checklistTemplate !== undefined) await replaceTemplate(tx, row.id, patch.checklistTemplate)
  })
  return (await listCategories(db, { withCounts: true })).find((c) => c.key === key)!
}

export async function deleteCategory(db: Db, key: CategoryKey) {
  const row = await getRow(db, key)
  const { n } = (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM tasks WHERE category_id = ?", row.id))!
  if (n > 0) {
    throw new HttpError(
      409,
      "conflict",
      `Essa categoria tem ${n === 1 ? "1 tarefa" : `${n} tarefas`}. Desative em vez de excluir, para não perder o histórico.`
    )
  }
  const { active } = (await db.get<{ active: number }>(
    "SELECT COUNT(*) AS active FROM categories WHERE is_active = 1 AND id != ?",
    row.id
  ))!
  if (active === 0) throw new HttpError(409, "conflict", "Mantenha pelo menos uma categoria ativa.")
  // O modelo de checklist sai junto, sem depender de ON DELETE CASCADE (desligado no Turso).
  await db.transaction(async (tx) => {
    await tx.run("DELETE FROM category_checklist_templates WHERE category_id = ?", row.id)
    await tx.run("DELETE FROM categories WHERE id = ?", row.id)
  })
}

export async function reorderCategories(db: Db, keys: CategoryKey[]) {
  await db.transaction(async (tx) => {
    for (const [i, key] of keys.entries()) await tx.run("UPDATE categories SET position = ? WHERE key = ?", i + 1, key)
  })
}
