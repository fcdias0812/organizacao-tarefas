import { Router, type CookieOptions } from "express"
import { changePasswordSchema, loginSchema } from "@tarefas/shared"

import { currentUser, requireAuth } from "../auth/middleware"
import { createLoginLimiter } from "../auth/loginLimiter"
import {
  createSession,
  deleteSession,
  hashPassword,
  hashToken,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  verifyCredentials,
} from "../auth/sessions"
import type { Db } from "../db/connection"
import { HttpError, parseBody } from "../http/errors"
import { toUserDTO } from "../services/users"

export function authRoutes(db: Db, options: { secureCookies: boolean }) {
  const router = Router()
  const cookie: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: options.secureCookies,
    path: "/",
  }

  const limiter = createLoginLimiter()

  router.post("/login", async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body)
    const ip = req.ip ?? "?"
    const wait = limiter.blockedFor(ip, email)
    if (wait > 0) {
      throw new HttpError(429, "too_many_attempts", `Muitas tentativas erradas. Tente de novo em ${wait} min.`)
    }

    const user = await verifyCredentials(db, email, password)
    if (!user) {
      limiter.fail(ip, email)
      throw new HttpError(401, "invalid_credentials", "E-mail ou senha incorretos.")
    }
    limiter.succeed(ip, email)

    const token = await createSession(db, user.id)
    res.cookie(SESSION_COOKIE, token, { ...cookie, maxAge: SESSION_TTL_MS })
    res.json({ user: toUserDTO(user) })
  })

  router.post("/logout", async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE]
    if (typeof token === "string") await deleteSession(db, token)
    res.clearCookie(SESSION_COOKIE, cookie)
    res.status(204).end()
  })

  router.get("/me", requireAuth(db), (_req, res) => {
    res.json({ user: currentUser(res) })
  })

  /** Troca a própria senha; as outras sessões da pessoa são encerradas. */
  router.post("/password", requireAuth(db), async (req, res) => {
    const me = currentUser(res)
    const { currentPassword, newPassword } = parseBody(changePasswordSchema, req.body)
    if (!(await verifyCredentials(db, me.email, currentPassword))) {
      throw new HttpError(422, "invalid_credentials", "A senha atual não confere.")
    }
    const passwordHash = await hashPassword(newPassword)
    await db.run("UPDATE users SET password_hash = ? WHERE id = ?", passwordHash, me.id)
    const token = req.cookies?.[SESSION_COOKIE]
    await db.run("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?", me.id, hashToken(String(token)))
    res.status(204).end()
  })

  return router
}
