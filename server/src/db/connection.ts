import { mkdirSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { createClient, type Client, type InValue, type Transaction } from "@libsql/client"

export type SqlValue = InValue

/**
 * Acesso ao banco. O mesmo código fala com um arquivo SQLite local (desenvolvimento e
 * testes) ou com o Turso (SQLite hospedado), via @libsql/client. Todas as operações são
 * assíncronas; dentro de `transaction`, use o `tx` recebido em vez do `db` de fora.
 */
export interface Db {
  all<T>(sql: string, ...args: SqlValue[]): Promise<T[]>
  get<T>(sql: string, ...args: SqlValue[]): Promise<T | undefined>
  run(sql: string, ...args: SqlValue[]): Promise<{ changes: number; lastInsertRowid: number }>
  /** Vários comandos separados por ";" (sem parâmetros). */
  exec(sql: string): Promise<void>
  /** Executa `fn` dentro de uma transação; desfaz tudo se lançar erro. Aninhada, reaproveita a de fora. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>
  close(): void
}

export interface DbTarget {
  /** `file:caminho/do/arquivo.db`, `:memory:` (testes) ou a URL `libsql://` do Turso. */
  url: string
  authToken?: string
}

const MIGRATIONS_DIR = join(import.meta.dirname, "migrations")

/** Monta o alvo a partir de um caminho de arquivo local. */
export const localTarget = (file: string): DbTarget =>
  file === ":memory:" ? { url: ":memory:" } : { url: `file:${file.replaceAll("\\", "/")}` }

/** Abre (ou cria) o banco e aplica as migrações pendentes. */
export async function openDatabase(target: DbTarget): Promise<Db> {
  const isLocalFile = target.url.startsWith("file:")
  if (isLocalFile) mkdirSync(dirname(target.url.slice("file:".length)), { recursive: true })

  const client = createClient({ url: target.url, authToken: target.authToken })
  // No Turso as chaves estrangeiras ficam desligadas; o código não depende delas
  // (exclusões em cascata são feitas explicitamente), aqui é só uma proteção extra local.
  if (target.url === ":memory:" || isLocalFile) {
    await client.executeMultiple("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
    if (isLocalFile) await client.execute("PRAGMA journal_mode = WAL")
  }

  const db = wrap(client, client)
  await migrate(db)
  return db
}

function wrap(executor: Client | Transaction, client: Client, inTransaction = false): Db {
  const execute = (sql: string, args: SqlValue[]) => executor.execute({ sql, args })

  const db: Db = {
    async all<T>(sql: string, ...args: SqlValue[]) {
      return (await execute(sql, args)).rows as unknown as T[]
    },
    async get<T>(sql: string, ...args: SqlValue[]) {
      return (await execute(sql, args)).rows[0] as unknown as T | undefined
    },
    async run(sql: string, ...args: SqlValue[]) {
      const result = await execute(sql, args)
      return { changes: result.rowsAffected, lastInsertRowid: Number(result.lastInsertRowid ?? 0) }
    },
    exec: (sql) => executor.executeMultiple(sql),
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (inTransaction) return fn(db)
      const tx = await client.transaction("write")
      try {
        const result = await fn(wrap(tx, client, true))
        await tx.commit()
        return result
      } catch (error) {
        await tx.rollback()
        throw error
      } finally {
        tx.close()
      }
    },
    close: () => client.close(),
  }
  return db
}

async function migrate(db: Db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`)

  const applied = new Set(
    (await db.all<{ version: string }>("SELECT version FROM schema_migrations")).map((row) => String(row.version))
  )
  const pending = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && !applied.has(f))
    .sort()

  for (const file of pending) {
    await db.transaction(async (tx) => {
      await tx.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
      await tx.run("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", file, new Date().toISOString())
    })
  }
}
