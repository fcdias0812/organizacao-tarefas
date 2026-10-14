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

import type { Db } from "../db/connection"
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

export async function findUserById(db: Db, id: number): Promise<UserDTO | null> {
  const row = await db.get<UserRow>("SELECT * FROM users WHERE id = ? AND is_active = 1", id)
  return row ? toUserDTO(row) : null
}

export async function listUsers(db: Db): Promise<UserDTO[]> {
  return (await db.all<UserRow>("SELECT * FROM users WHERE is_active = 1 ORDER BY name")).map(toUserDTO)
}

export async function insertUser(
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
): Promise<number> {
  const result = await db.run(
    `INSERT INTO users (name, email, password_hash, role, is_admin, job_title, avatar_color, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    user.name,
    user.email.toLowerCase(),
    user.passwordHash,
    user.role,
    user.isAdmin && user.role === "manager" ? 1 : 0,
    user.jobTitle ?? null,
    user.avatarColor,
    new Date().toISOString()
  )
  return result.lastInsertRowid
}

/** Senha temporária legível (sem caracteres que se confundem, como 0/O e 1/l). */
export function generatePassword(length = 12) {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("")
}

/* ───────────────────────── administração ───────────────────────── */

async function getRow(db: Db, id: number): Promise<UserRow> {
  const row = await db.get<UserRow>("SELECT * FROM users WHERE id = ?", id)
  if (!row) throw notFound("Usuário não encontrado.")
  return row
}

async function ensureEmailFree(db: Db, email: string, exceptId = 0) {
  if (await db.get("SELECT 1 FROM users WHERE email = ? AND id != ?", email.toLowerCase(), exceptId)) {
    throw new HttpError(409, "conflict", "Já existe um usuário com este e-mail.")
  }
}

export async function listAllUsers(db: Db): Promise<AdminUserDTO[]> {
  return (await db.all<UserRow>("SELECT * FROM users ORDER BY is_active DESC, name")).map(toAdminDTO)
}

export async function createUserAsAdmin(
  db: Db,
  input: CreateUserInput,
  hash: (password: string) => Promise<string>
): Promise<{ user: AdminUserDTO; temporaryPassword: string }> {
  await ensureEmailFree(db, input.email)
  const temporaryPassword = generatePassword()
  const passwordHash = await hash(temporaryPassword)
  const { n } = (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM users"))!
  const id = await insertUser(db, {
    ...input,
    passwordHash,
    avatarColor: input.avatarColor ?? AVATAR_COLORS[n % AVATAR_COLORS.length],
  })
  return { user: toAdminDTO(await getRow(db, id)), temporaryPassword }
}

export async function updateUserAsAdmin(db: Db, actorId: number, id: number, patch: UpdateUserInput): Promise<AdminUserDTO> {
  const row = await getRow(db, id)
  if (patch.email !== undefined) await ensureEmailFree(db, patch.email, id)

  const role = patch.role ?? row.role
  // Executor nunca é administrador.
  const isAdmin = role === "manager" ? (patch.isAdmin ?? row.is_admin === 1) : false
  const isActive = patch.isActive ?? row.is_active === 1

  if (id === actorId) {
    if (!isActive) throw new HttpError(409, "conflict", "Você não pode desativar a própria conta.")
    if (!isAdmin) throw new HttpError(409, "conflict", "Você não pode tirar o próprio acesso de administrador.")
  }

  await db.transaction(async (tx) => {
    await tx.run(
      `UPDATE users SET name = ?, email = ?, role = ?, is_admin = ?, job_title = ?, avatar_color = ?, is_active = ?
       WHERE id = ?`,
      patch.name ?? row.name,
      (patch.email ?? row.email).toLowerCase(),
      role,
      isAdmin ? 1 : 0,
      patch.jobTitle !== undefined ? patch.jobTitle : row.job_title,
      patch.avatarColor ?? row.avatar_color,
      isActive ? 1 : 0,
      id
    )
    const { admins } = (await tx.get<{ admins: number }>(
      "SELECT COUNT(*) AS admins FROM users WHERE is_admin = 1 AND is_active = 1"
    ))!
    if (admins === 0) throw new HttpError(409, "conflict", "O sistema precisa de pelo menos um administrador ativo.")
    if (!isActive) await tx.run("DELETE FROM sessions WHERE user_id = ?", id)
  })
  return toAdminDTO(await getRow(db, id))
}

/** Gera senha nova e encerra as sessões abertas da pessoa. */
export async function resetPasswordAsAdmin(
  db: Db,
  id: number,
  hash: (password: string) => Promise<string>
): Promise<string> {
  await getRow(db, id)
  const temporaryPassword = generatePassword()
  const passwordHash = await hash(temporaryPassword)
  await db.transaction(async (tx) => {
    await tx.run("UPDATE users SET password_hash = ? WHERE id = ?", passwordHash, id)
    await tx.run("DELETE FROM sessions WHERE user_id = ?", id)
  })
  return temporaryPassword
}
