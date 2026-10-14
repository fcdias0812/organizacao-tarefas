import type { RequestHandler, Response } from "express"
import type { UserDTO } from "@tarefas/shared"

import type { Db } from "../db/connection"
import { HttpError } from "../http/errors"
import { getSessionUser, SESSION_COOKIE } from "./sessions"

/** Exige sessão válida e deixa o usuário em `res.locals.user`. */
export function requireAuth(db: Db): RequestHandler {
  return (req, res, next) => {
    const token = req.cookies?.[SESSION_COOKIE]
    const user = typeof token === "string" ? getSessionUser(db, token) : null
    if (!user) return next(new HttpError(401, "unauthenticated", "Sua sessão expirou. Entre novamente."))
    res.locals.user = user
    next()
  }
}

export function currentUser(res: Response): UserDTO {
  return res.locals.user as UserDTO
}
