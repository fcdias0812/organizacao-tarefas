import { mkdirSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { DatabaseSync } from "node:sqlite"

export type Db = DatabaseSync

const MIGRATIONS_DIR = join(import.meta.dirname, "migrations")

/** Abre (ou cria) o banco e aplica as migrações pendentes. Use ":memory:" nos testes. */
export function openDatabase(file: string): Db {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true })

  const db = new DatabaseSync(file, { enableForeignKeyConstraints: true })
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;")
  migrate(db)
  return db
}

/** Executa `fn` dentro de uma transação; desfaz tudo se lançar erro. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN")
  try {
    const result = fn()
    db.exec("COMMIT")
    return result
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

function migrate(db: Db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`)

  const applied = new Set(
    db.prepare("SELECT version FROM schema_migrations").all().map((row) => String(row.version))
  )
  const pending = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !applied.has(f))
    .sort()

  for (const file of pending) {
    transaction(db, () => {
      db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
        file,
        new Date().toISOString()
      )
    })
  }
}
