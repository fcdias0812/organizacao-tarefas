import type { CategoryDTO, CategoryKey, CreateCategoryInput, UpdateCategoryInput } from "@tarefas/shared"

import { transaction, type Db } from "../db/connection"
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

export function getTemplate(db: Db, categoryId: number): string[] {
  return (
    db
      .prepare("SELECT label FROM category_checklist_templates WHERE category_id = ? ORDER BY position")
      .all(categoryId) as { label: string }[]
  ).map((r) => r.label)
}

const toDTO = (db: Db, row: CategoryRow, withCount: boolean): CategoryDTO => ({
  key: row.key,
  name: row.name,
  icon: row.icon,
  isActive: row.is_active === 1,
  position: row.position,
  checklistTemplate: getTemplate(db, row.id),
  ...(withCount ? { taskCount: row.task_count ?? 0 } : {}),
})

/** Todas as categorias (as desativadas também, para exibir tarefas antigas). */
export function listCategories(db: Db, options: { withCounts?: boolean } = {}): CategoryDTO[] {
  const rows = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM tasks t WHERE t.category_id = c.id) AS task_count
       FROM categories c ORDER BY c.position, c.id`
    )
    .all() as unknown as CategoryRow[]
  return rows.map((r) => toDTO(db, r, options.withCounts ?? false))
}

function getRow(db: Db, key: CategoryKey): CategoryRow {
  const row = db.prepare("SELECT * FROM categories WHERE key = ?").get(key) as CategoryRow | undefined
  if (!row) throw notFound("Categoria não encontrada.")
  return row
}

/** Id da categoria para gravar numa tarefa. Novas tarefas só usam categorias ativas. */
export function getCategoryId(db: Db, key: CategoryKey, options: { mustBeActive?: boolean } = {}): number {
  const row = db.prepare("SELECT id, is_active FROM categories WHERE key = ?").get(key) as
    | { id: number; is_active: number }
    | undefined
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

function replaceTemplate(db: Db, categoryId: number, items: string[]) {
  db.prepare("DELETE FROM category_checklist_templates WHERE category_id = ?").run(categoryId)
  const insert = db.prepare("INSERT INTO category_checklist_templates (category_id, label, position) VALUES (?, ?, ?)")
  items.forEach((label, i) => insert.run(categoryId, label, i + 1))
}

function ensureUniqueName(db: Db, name: string, exceptId = 0) {
  const clash = db
    .prepare("SELECT 1 FROM categories WHERE lower(name) = lower(?) AND id != ?")
    .get(name, exceptId)
  if (clash) throw new HttpError(409, "conflict", `Já existe uma categoria chamada "${name}".`)
}

export function createCategory(db: Db, input: CreateCategoryInput): CategoryDTO {
  ensureUniqueName(db, input.name)
  const key = transaction(db, () => {
    const base = slugify(input.name)
    let key = base
    for (let n = 2; db.prepare("SELECT 1 FROM categories WHERE key = ?").get(key); n++) key = `${base}-${n}`
    const { next } = db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS next FROM categories").get() as { next: number }
    const result = db
      .prepare("INSERT INTO categories (key, name, icon, position, is_active) VALUES (?, ?, ?, ?, 1)")
      .run(key, input.name, input.icon, next)
    replaceTemplate(db, Number(result.lastInsertRowid), input.checklistTemplate)
    return key
  })
  return toDTO(db, getRow(db, key), true)
}

export function updateCategory(db: Db, key: CategoryKey, patch: UpdateCategoryInput): CategoryDTO {
  const row = getRow(db, key)
  if (patch.name !== undefined) ensureUniqueName(db, patch.name, row.id)
  if (patch.isActive === false) {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM categories WHERE is_active = 1 AND id != ?").get(row.id) as { n: number }
    if (n === 0) throw new HttpError(409, "conflict", "Mantenha pelo menos uma categoria ativa.")
  }

  transaction(db, () => {
    if (patch.name !== undefined) db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(patch.name, row.id)
    if (patch.icon !== undefined) db.prepare("UPDATE categories SET icon = ? WHERE id = ?").run(patch.icon, row.id)
    if (patch.isActive !== undefined) {
      db.prepare("UPDATE categories SET is_active = ? WHERE id = ?").run(patch.isActive ? 1 : 0, row.id)
    }
    // O modelo vale para tarefas novas; as existentes mantêm o checklist que já têm.
    if (patch.checklistTemplate !== undefined) replaceTemplate(db, row.id, patch.checklistTemplate)
  })
  return listCategories(db, { withCounts: true }).find((c) => c.key === key)!
}

export function deleteCategory(db: Db, key: CategoryKey) {
  const row = getRow(db, key)
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE category_id = ?").get(row.id) as { n: number }
  if (n > 0) {
    throw new HttpError(
      409,
      "conflict",
      `Essa categoria tem ${n === 1 ? "1 tarefa" : `${n} tarefas`}. Desative em vez de excluir, para não perder o histórico.`
    )
  }
  const { active } = db.prepare("SELECT COUNT(*) AS active FROM categories WHERE is_active = 1 AND id != ?").get(row.id) as {
    active: number
  }
  if (active === 0) throw new HttpError(409, "conflict", "Mantenha pelo menos uma categoria ativa.")
  db.prepare("DELETE FROM categories WHERE id = ?").run(row.id)
}

export function reorderCategories(db: Db, keys: CategoryKey[]) {
  transaction(db, () => {
    const update = db.prepare("UPDATE categories SET position = ? WHERE key = ?")
    keys.forEach((key, i) => update.run(i + 1, key))
  })
}
