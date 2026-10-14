import { existsSync } from "node:fs"
import { join } from "node:path"
import cookieParser from "cookie-parser"
import express from "express"

import { requireAuth } from "./auth/middleware"
import type { Db } from "./db/connection"
import { errorHandler, notFound, requireJson } from "./http/errors"
import { authRoutes } from "./routes/auth"
import { taskRoutes } from "./routes/tasks"
import { listCategories } from "./services/categories"
import { listUsers } from "./services/users"

export interface AppOptions {
  db: Db
  secureCookies?: boolean
  /** Pasta com o build do client; quando existe, o servidor também entrega as telas. */
  clientDist?: string
}

export function createApp({ db, secureCookies = false, clientDist }: AppOptions) {
  const app = express()
  app.disable("x-powered-by")

  // Cabeçalhos de segurança básicos. A CSP só vale para as telas (a API responde JSON).
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("X-Frame-Options", "DENY")
    res.setHeader("Referrer-Policy", "same-origin")
    if (!req.path.startsWith("/api")) {
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
      )
    }
    next()
  })

  const api = express.Router()
  api.use(express.json({ limit: "100kb" }))
  api.use(cookieParser())
  api.use(requireJson)

  api.use("/auth", authRoutes(db, { secureCookies }))

  api.use(requireAuth(db))
  api.get("/users", (_req, res) => {
    res.json({ users: listUsers(db) })
  })
  api.get("/categories", (_req, res) => {
    res.json({ categories: listCategories(db) })
  })
  api.use("/tasks", taskRoutes(db))
  api.use((_req, _res, next) => next(notFound("Rota não encontrada.")))

  app.use("/api", api)

  if (clientDist && existsSync(join(clientDist, "index.html"))) {
    // Arquivos com hash no nome nunca mudam: cache longo. O index.html sempre é revalidado.
    app.use(
      "/assets",
      express.static(join(clientDist, "assets"), { immutable: true, maxAge: "1y", index: false })
    )
    app.use(express.static(clientDist, { index: false }))
    app.get("/{*splat}", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache")
      res.sendFile(join(clientDist, "index.html"))
    })
  }

  app.use(errorHandler)
  return app
}
