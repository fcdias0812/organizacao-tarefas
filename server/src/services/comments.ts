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

export async function listComments(db: Db, taskId: number): Promise<CommentDTO[]> {
  return (await db.all<CommentRow>("SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at, id", taskId)).map(toDTO)
}

async function getRow(db: Db, taskId: number, id: number): Promise<CommentRow> {
  const row = await db.get<CommentRow>("SELECT * FROM task_comments WHERE id = ? AND task_id = ?", id, taskId)
  if (!row) throw notFound("Comentário não encontrado.")
  return row
}

export async function addComment(db: Db, actor: UserDTO, taskId: number, body: string): Promise<CommentDTO> {
  if (!(await db.get("SELECT 1 FROM tasks WHERE id = ?", taskId))) throw notFound("Tarefa não encontrada.")
  const now = new Date().toISOString()
  const result = await db.run(
    "INSERT INTO task_comments (task_id, author_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    taskId,
    actor.id,
    body,
    now,
    now
  )
  return toDTO(await getRow(db, taskId, result.lastInsertRowid))
}

/** Só quem escreveu edita o próprio comentário. */
export async function updateComment(db: Db, actor: UserDTO, taskId: number, id: number, body: string): Promise<CommentDTO> {
  const row = await getRow(db, taskId, id)
  if (row.author_id !== actor.id) throw new HttpError(403, "forbidden", "Só quem escreveu pode editar o comentário.")
  await db.run("UPDATE task_comments SET body = ?, updated_at = ? WHERE id = ?", body, new Date().toISOString(), id)
  return toDTO(await getRow(db, taskId, id))
}

/** Quem escreveu ou um administrador pode excluir. */
export async function deleteComment(db: Db, actor: UserDTO, taskId: number, id: number) {
  const row = await getRow(db, taskId, id)
  if (row.author_id !== actor.id && !actor.isAdmin) {
    throw new HttpError(403, "forbidden", "Só quem escreveu (ou um administrador) pode excluir o comentário.")
  }
  await db.run("DELETE FROM task_comments WHERE id = ?", id)
}
