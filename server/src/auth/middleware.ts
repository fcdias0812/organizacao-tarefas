import type { RequestHandler, Response } from "express"
import type { UserDTO } from "@tarefas/shared"

import type { Db } from "../db/connection"
import { HttpError } from "../http/errors"
import { getSessionUser, SESSION_COOKIE } from "./sessions"

/** Exige sessão válida e deixa o usuário em `res.locals.user`. */
export function requireAuth(db: Db): RequestHandler {
  return async (req, res, next) => {
    const token = req.cookies?.[SESSION_COOKIE]
    const user = typeof token === "string" ? await getSessionUser(db, token) : null
    if (!user) return next(new HttpError(401, "unauthenticated", "Sua sessão expirou. Entre novamente."))
    res.locals.user = user
    next()
  }
}

export function currentUser(res: Response): UserDTO {
  return res.locals.user as UserDTO
}

/** Só o administrador entra em Configurações. Usar depois de requireAuth. */
export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (!currentUser(res).isAdmin) {
    return next(new HttpError(403, "forbidden", "Só o administrador acessa as configurações."))
  }
  next()
}
