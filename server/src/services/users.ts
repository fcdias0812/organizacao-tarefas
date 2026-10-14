import type { AvatarColor, UserDTO, UserRole } from "@tarefas/shared"

import type { Db } from "../db/connection"

export interface UserRow {
  id: number
  name: string
  email: string
  password_hash: string
  role: UserRole
  job_title: string | null
  avatar_color: AvatarColor
  is_active: number
  created_at: string
}

export function toUserDTO(row: UserRow): UserDTO {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    jobTitle: row.job_title,
    avatarColor: row.avatar_color,
  }
}

export function findUserById(db: Db, id: number): UserDTO | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ? AND is_active = 1").get(id) as UserRow | undefined
  return row ? toUserDTO(row) : null
}

export function listUsers(db: Db): UserDTO[] {
  const rows = db.prepare("SELECT * FROM users WHERE is_active = 1 ORDER BY name").all() as unknown as UserRow[]
  return rows.map(toUserDTO)
}

export function insertUser(
  db: Db,
  user: { name: string; email: string; passwordHash: string; role: UserRole; jobTitle?: string; avatarColor: AvatarColor }
): number {
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, job_title, avatar_color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(user.name, user.email, user.passwordHash, user.role, user.jobTitle ?? null, user.avatarColor, new Date().toISOString())
  return Number(result.lastInsertRowid)
}
