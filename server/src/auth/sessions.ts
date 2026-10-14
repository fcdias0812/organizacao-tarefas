import { createHash, randomBytes } from "node:crypto"
import { compare, hash } from "bcryptjs"
import type { UserDTO } from "@tarefas/shared"

import type { Db } from "../db/connection"
import { findUserById, type UserRow } from "../services/users"

export const SESSION_COOKIE = "sid"
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 dias

const BCRYPT_ROUNDS = 10

export const hashPassword = (password: string) => hash(password, BCRYPT_ROUNDS)

// Hash comparado quando o e-mail não existe, para o tempo de resposta não
// revelar quais e-mails estão cadastrados.
let dummyHash: Promise<string> | undefined
const getDummyHash = () => (dummyHash ??= hashPassword(randomBytes(16).toString("hex")))

export async function verifyCredentials(db: Db, email: string, password: string): Promise<UserRow | null> {
  const row = await db.get<UserRow>("SELECT * FROM users WHERE email = ? AND is_active = 1", email)
  const valid = await compare(password, row?.password_hash ?? (await getDummyHash()))
  return row && valid ? row : null
}

// O token vai só no cookie; no banco fica apenas o hash dele.
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

export async function createSession(db: Db, userId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url")
  const now = Date.now()
  await db.run(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    hashToken(token),
    userId,
    new Date(now).toISOString(),
    new Date(now + SESSION_TTL_MS).toISOString()
  )
  return token
}

export async function getSessionUser(db: Db, token: string): Promise<UserDTO | null> {
  const session = await db.get<{ user_id: number; expires_at: string }>(
    "SELECT user_id, expires_at FROM sessions WHERE token_hash = ?",
    hashToken(token)
  )
  if (!session) return null

  if (session.expires_at <= new Date().toISOString()) {
    await deleteSession(db, token)
    return null
  }
  return findUserById(db, session.user_id)
}

export async function deleteSession(db: Db, token: string) {
  await db.run("DELETE FROM sessions WHERE token_hash = ?", hashToken(token))
}
