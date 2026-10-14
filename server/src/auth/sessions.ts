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
  const row = db
    .prepare("SELECT * FROM users WHERE email = ? AND is_active = 1")
    .get(email) as UserRow | undefined
  const valid = await compare(password, row?.password_hash ?? (await getDummyHash()))
  return row && valid ? row : null
}

// O token vai só no cookie; no banco fica apenas o hash dele.
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

export function createSession(db: Db, userId: number): string {
  const token = randomBytes(32).toString("base64url")
  const now = Date.now()
  db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
    hashToken(token),
    userId,
    new Date(now).toISOString(),
    new Date(now + SESSION_TTL_MS).toISOString()
  )
  return token
}

export function getSessionUser(db: Db, token: string): UserDTO | null {
  const session = db
    .prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?")
    .get(hashToken(token)) as { user_id: number; expires_at: string } | undefined
  if (!session) return null

  if (session.expires_at <= new Date().toISOString()) {
    deleteSession(db, token)
    return null
  }
  return findUserById(db, session.user_id)
}

export function deleteSession(db: Db, token: string) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token))
}
