import { randomInt } from "node:crypto"
import {
  AVATAR_COLORS,
  type AdminUserDTO,
  type AvatarColor,
  type CreateUserInput,
  type UpdateUserInput,
  type UserDTO,
  type UserRole,
} from "@tarefas/shared"

import { transaction, type Db } from "../db/connection"
import { HttpError, notFound } from "../http/errors"

export interface UserRow {
  id: number
  name: string
  email: string
  password_hash: string
  role: UserRole
  is_admin: number
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
    isAdmin: row.is_admin === 1,
    jobTitle: row.job_title,
    avatarColor: row.avatar_color,
  }
}

const toAdminDTO = (row: UserRow): AdminUserDTO => ({
  ...toUserDTO(row),
  isActive: row.is_active === 1,
  createdAt: row.created_at,
})

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
  user: {
    name: string
    email: string
    passwordHash: string
    role: UserRole
    isAdmin?: boolean
    jobTitle?: string | null
    avatarColor: AvatarColor
  }
): number {
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, is_admin, job_title, avatar_color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      user.name,
      user.email.toLowerCase(),
      user.passwordHash,
      user.role,
      user.isAdmin && user.role === "manager" ? 1 : 0,
      user.jobTitle ?? null,
      user.avatarColor,
      new Date().toISOString()
    )
  return Number(result.lastInsertRowid)
}

/** Senha temporária legível (sem caracteres que se confundem, como 0/O e 1/l). */
export function generatePassword(length = 12) {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("")
}

/* ───────────────────────── administração ───────────────────────── */

function getRow(db: Db, id: number): UserRow {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined
  if (!row) throw notFound("Usuário não encontrado.")
  return row
}

function ensureEmailFree(db: Db, email: string, exceptId = 0) {
  if (db.prepare("SELECT 1 FROM users WHERE email = ? AND id != ?").get(email.toLowerCase(), exceptId)) {
    throw new HttpError(409, "conflict", "Já existe um usuário com este e-mail.")
  }
}

export function listAllUsers(db: Db): AdminUserDTO[] {
  const rows = db.prepare("SELECT * FROM users ORDER BY is_active DESC, name").all() as unknown as UserRow[]
  return rows.map(toAdminDTO)
}

export function createUserAsAdmin(
  db: Db,
  input: CreateUserInput,
  hash: (password: string) => Promise<string>
): Promise<{ user: AdminUserDTO; temporaryPassword: string }> {
  ensureEmailFree(db, input.email)
  const temporaryPassword = generatePassword()
  return hash(temporaryPassword).then((passwordHash) => {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }
    const id = insertUser(db, {
      ...input,
      passwordHash,
      avatarColor: input.avatarColor ?? AVATAR_COLORS[n % AVATAR_COLORS.length],
    })
    return { user: toAdminDTO(getRow(db, id)), temporaryPassword }
  })
}

export function updateUserAsAdmin(db: Db, actorId: number, id: number, patch: UpdateUserInput): AdminUserDTO {
  const row = getRow(db, id)
  if (patch.email !== undefined) ensureEmailFree(db, patch.email, id)

  const role = patch.role ?? row.role
  // Executor nunca é administrador.
  const isAdmin = role === "manager" ? (patch.isAdmin ?? row.is_admin === 1) : false
  const isActive = patch.isActive ?? row.is_active === 1

  if (id === actorId) {
    if (!isActive) throw new HttpError(409, "conflict", "Você não pode desativar a própria conta.")
    if (!isAdmin) throw new HttpError(409, "conflict", "Você não pode tirar o próprio acesso de administrador.")
  }

  transaction(db, () => {
    db.prepare(
      `UPDATE users SET name = ?, email = ?, role = ?, is_admin = ?, job_title = ?, avatar_color = ?, is_active = ?
       WHERE id = ?`
    ).run(
      patch.name ?? row.name,
      (patch.email ?? row.email).toLowerCase(),
      role,
      isAdmin ? 1 : 0,
      patch.jobTitle !== undefined ? patch.jobTitle : row.job_title,
      patch.avatarColor ?? row.avatar_color,
      isActive ? 1 : 0,
      id
    )
    const { admins } = db.prepare("SELECT COUNT(*) AS admins FROM users WHERE is_admin = 1 AND is_active = 1").get() as {
      admins: number
    }
    if (admins === 0) throw new HttpError(409, "conflict", "O sistema precisa de pelo menos um administrador ativo.")
    if (!isActive) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id)
  })
  return toAdminDTO(getRow(db, id))
}

/** Gera senha nova e encerra as sessões abertas da pessoa. */
export async function resetPasswordAsAdmin(
  db: Db,
  id: number,
  hash: (password: string) => Promise<string>
): Promise<string> {
  getRow(db, id)
  const temporaryPassword = generatePassword()
  const passwordHash = await hash(temporaryPassword)
  transaction(db, () => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id)
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id)
  })
  return temporaryPassword
}
