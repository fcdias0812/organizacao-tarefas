import { existsSync } from "node:fs"
import { join, resolve } from "node:path"

import { localTarget, type DbTarget } from "./db/connection"

export const ROOT_DIR = resolve(import.meta.dirname, "../..")

const envFile = join(ROOT_DIR, "server", ".env")
if (existsSync(envFile)) process.loadEnvFile(envFile)

const dbPath = resolve(ROOT_DIR, process.env.DB_PATH ?? "data/tarefas.db")
const tursoUrl = process.env.TURSO_DATABASE_URL

export const config = {
  port: Number(process.env.PORT ?? 3333),
  /** Com TURSO_DATABASE_URL usa o Turso; senão, o arquivo local em DB_PATH. */
  db: (tursoUrl ? { url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN } : localTarget(dbPath)) satisfies DbTarget,
  /** Caminho do arquivo local (só existe sem Turso). */
  dbPath: tursoUrl ? null : dbPath,
  /** Ligue quando o sistema estiver atrás de HTTPS. */
  secureCookies: process.env.COOKIE_SECURE === "true",
  clientDist: join(ROOT_DIR, "client", "dist"),
}

/** Onde estão os dados, para mensagens no terminal (nunca mostra o token). */
export const dbLabel = config.dbPath ?? `Turso (${tursoUrl})`
