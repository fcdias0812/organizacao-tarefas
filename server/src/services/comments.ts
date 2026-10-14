import type { CommentDTO, UserDTO } from "@tarefas/shared"

import type { Db } from "../db/connection"
import { HttpError, notFound } from "../http/errors"

interface CommentRow {
  id: number
  task_id: number
  author_id: number
  body: string
  created_at: string
  updated_at: string
}

const toDTO = (r: CommentRow): CommentDTO => ({
  id: r.id,
  authorId: r.author_id,
  body: r.body,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export function listComments(db: Db, taskId: number): CommentDTO[] {
  return (
    db.prepare("SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at, id").all(taskId) as unknown as CommentRow[]
  ).map(toDTO)
}

function getRow(db: Db, taskId: number, id: number): CommentRow {
  const row = db.prepare("SELECT * FROM task_comments WHERE id = ? AND task_id = ?").get(id, taskId) as
    | CommentRow
    | undefined
  if (!row) throw notFound("Comentário não encontrado.")
  return row
}

export function addComment(db: Db, actor: UserDTO, taskId: number, body: string): CommentDTO {
  if (!db.prepare("SELECT 1 FROM tasks WHERE id = ?").get(taskId)) throw notFound("Tarefa não encontrada.")
  const now = new Date().toISOString()
  const result = db
    .prepare("INSERT INTO task_comments (task_id, author_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(taskId, actor.id, body, now, now)
  return toDTO(getRow(db, taskId, Number(result.lastInsertRowid)))
}

/** Só quem escreveu edita o próprio comentário. */
export function updateComment(db: Db, actor: UserDTO, taskId: number, id: number, body: string): CommentDTO {
  const row = getRow(db, taskId, id)
  if (row.author_id !== actor.id) throw new HttpError(403, "forbidden", "Só quem escreveu pode editar o comentário.")
  db.prepare("UPDATE task_comments SET body = ?, updated_at = ? WHERE id = ?").run(body, new Date().toISOString(), id)
  return toDTO(getRow(db, taskId, id))
}

/** Quem escreveu ou um administrador pode excluir. */
export function deleteComment(db: Db, actor: UserDTO, taskId: number, id: number) {
  const row = getRow(db, taskId, id)
  if (row.author_id !== actor.id && !actor.isAdmin) {
    throw new HttpError(403, "forbidden", "Só quem escreveu (ou um administrador) pode excluir o comentário.")
  }
  db.prepare("DELETE FROM task_comments WHERE id = ?").run(id)
}
