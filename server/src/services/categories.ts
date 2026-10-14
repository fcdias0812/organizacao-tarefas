import type { CategoryDTO, CategoryKey } from "@tarefas/shared"

import type { Db } from "../db/connection"
import { HttpError } from "../http/errors"

export function listCategories(db: Db): CategoryDTO[] {
  const categories = db.prepare("SELECT id, key, name FROM categories ORDER BY position").all() as {
    id: number
    key: CategoryKey
    name: string
  }[]
  return categories.map((c) => ({
    key: c.key,
    name: c.name,
    checklistTemplate: getTemplate(db, c.id),
  }))
}

export function getCategoryId(db: Db, key: CategoryKey): number {
  const row = db.prepare("SELECT id FROM categories WHERE key = ?").get(key) as { id: number } | undefined
  if (!row) throw new HttpError(422, "validation_error", "Categoria inválida.")
  return row.id
}

export function getTemplate(db: Db, categoryId: number): string[] {
  return (
    db
      .prepare("SELECT label FROM category_checklist_templates WHERE category_id = ? ORDER BY position")
      .all(categoryId) as { label: string }[]
  ).map((r) => r.label)
}
