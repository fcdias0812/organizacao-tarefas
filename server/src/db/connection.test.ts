import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"

import { localTarget, openDatabase } from "./connection"

const countSettings = async (db: Awaited<ReturnType<typeof openDatabase>>) =>
  (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM settings"))!.n

describe("banco", () => {
  it("transação desfaz tudo quando dá erro", async () => {
    const db = await openDatabase(localTarget(":memory:"))
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.run("INSERT INTO settings (key, value, updated_at) VALUES ('a', '{}', 'x')")
        throw new Error("falhou no meio")
      }),
      /falhou no meio/
    )
    assert.equal(await countSettings(db), 0)
    db.close()
  })

  it("transação aninhada usa a de fora e confirma junto", async () => {
    const db = await openDatabase(localTarget(":memory:"))
    const id = await db.transaction(async (tx) => {
      await tx.transaction(async (inner) => {
        await inner.run("INSERT INTO settings (key, value, updated_at) VALUES ('a', '{}', 'x')")
      })
      return (await tx.run("INSERT INTO settings (key, value, updated_at) VALUES ('b', '{}', 'x')")).lastInsertRowid
    })
    assert.equal(typeof id, "number")
    assert.equal(await countSettings(db), 2)
    db.close()
  })

  it("arquivo local guarda os dados e não reaplica migrações ao reabrir", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tarefas-"))
    const target = localTarget(join(dir, "sub", "teste.db"))
    try {
      const first = await openDatabase(target)
      await first.run("INSERT INTO settings (key, value, updated_at) VALUES ('a', '{}', 'x')")
      first.close()

      const second = await openDatabase(target)
      assert.equal(await countSettings(second), 1)
      second.close()
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        // No Windows o @libsql/client só solta o arquivo quando o processo termina; fica na pasta temporária.
      }
    }
  })
})
