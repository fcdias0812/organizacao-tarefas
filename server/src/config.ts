import { existsSync } from "node:fs"
import { join, resolve } from "node:path"

export const ROOT_DIR = resolve(import.meta.dirname, "../..")

const envFile = join(ROOT_DIR, "server", ".env")
if (existsSync(envFile)) process.loadEnvFile(envFile)

export const config = {
  port: Number(process.env.PORT ?? 3333),
  dbPath: resolve(ROOT_DIR, process.env.DB_PATH ?? "data/tarefas.db"),
  /** Ligue quando o sistema estiver atrás de HTTPS. */
  secureCookies: process.env.COOKIE_SECURE === "true",
  clientDist: join(ROOT_DIR, "client", "dist"),
}
