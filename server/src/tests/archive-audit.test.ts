import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import type { AuditEntryDTO, TaskDetailDTO, TaskSummaryDTO } from "@tarefas/shared"

import { startTestServer, type ApiClient } from "./helpers"

let ctx: Awaited<ReturnType<typeof startTestServer>>
let gerente: ApiClient // administrador
let coordenador: ApiClient // gestor
let analista: ApiClient // executor

before(async () => {
  ctx = await startTestServer()
  gerente = await ctx.login("gerente")
  coordenador = await ctx.login("coordenador")
  analista = await ctx.login("analista")
})
after(() => ctx.close())

async function createTask(client: ApiClient, title = "Trocar mouse") {
  const res = await client.request<{ task: TaskDetailDTO }>("POST", "/tasks", { title, category: "ticket" })
  assert.equal(res.status, 201, JSON.stringify(res.body))
  return res.body.task
}

const boardIds = async () => (await gerente.request<{ tasks: TaskSummaryDTO[] }>("GET", "/tasks")).body.tasks.map((t) => t.id)
const archivedIds = async () =>
  (await gerente.request<{ tasks: TaskSummaryDTO[] }>("GET", "/tasks/archived")).body.tasks.map((t) => t.id)
const audit = async (query = "") => (await analista.request<{ entries: AuditEntryDTO[]; hasMore: boolean }>("GET", `/audit${query}`)).body

describe("arquivar e restaurar", () => {
  it("arquivada sai do quadro, vai para as arquivadas e fica só para leitura", async () => {
    const task = await createTask(analista)
    const res = await analista.request<{ task: TaskSummaryDTO }>("POST", `/tasks/${task.id}/archive`)
    assert.equal(res.status, 200)
    assert.ok(res.body.task.archivedAt)
    assert.equal(res.body.task.archivedById, analista.userId)
    assert.ok(!(await boardIds()).includes(task.id))
    assert.ok((await archivedIds()).includes(task.id))

    // O detalhe continua abrindo, mas nada muda enquanto estiver arquivada.
    assert.equal((await gerente.request("GET", `/tasks/${task.id}`)).status, 200)
    assert.equal((await gerente.request("PATCH", `/tasks/${task.id}`, { title: "Outro" })).status, 409)
    assert.equal((await gerente.request("POST", `/tasks/${task.id}/move`, { status: "in_progress" })).status, 409)
    assert.equal((await gerente.request("POST", `/tasks/${task.id}/comments`, { body: "oi" })).status, 409)
    const item = task.checklist[0]
    assert.equal((await gerente.request("PATCH", `/tasks/${task.id}/checklist/${item.id}`, { isDone: true })).status, 409)

    const restored = await gerente.request<{ task: TaskSummaryDTO }>("POST", `/tasks/${task.id}/restore`)
    assert.equal(restored.status, 200)
    assert.equal(restored.body.task.archivedAt, null)
    assert.ok((await boardIds()).includes(task.id))

    const events = (await gerente.request<{ task: TaskDetailDTO }>("GET", `/tasks/${task.id}`)).body.task.events.map((e) => e.type)
    assert.deepEqual(events.slice(-2), ["archived", "restored"])
  })

  it("executor só arquiva o que ele mesmo criou", async () => {
    const doGestor = await createTask(coordenador)
    const res = await analista.request("POST", `/tasks/${doGestor.id}/archive`)
    assert.equal(res.status, 403)
    assert.equal(res.body.error.message, "Só o gestor ou quem criou a tarefa pode arquivá-la.")
  })

  it("arquivada não ocupa posição: inserir no topo da coluna continua no topo", async () => {
    const a = await createTask(gerente, "A")
    const b = await createTask(gerente, "B")
    await gerente.request("POST", `/tasks/${b.id}/archive`)
    // b estava no topo; arquivada, não conta para o índice 0.
    const moved = await gerente.request<{ task: TaskSummaryDTO }>("POST", `/tasks/${a.id}/move`, { status: "todo", index: 0 })
    assert.equal(moved.status, 200)
    const board = (await gerente.request<{ tasks: TaskSummaryDTO[] }>("GET", "/tasks")).body.tasks.filter((t) => t.status === "todo")
    assert.equal(board[0].id, a.id)
  })
})

describe("excluir de vez", () => {
  it("só o administrador, e só tarefa arquivada", async () => {
    const task = await createTask(coordenador, "Criada por engano")
    await coordenador.request("POST", `/tasks/${task.id}/comments`, { body: "comentário" })

    const ativa = await gerente.request("DELETE", `/tasks/${task.id}`)
    assert.equal(ativa.status, 409)
    assert.equal(ativa.body.error.message, "Arquive a tarefa antes de excluir de vez.")

    await coordenador.request("POST", `/tasks/${task.id}/archive`)
    assert.equal((await coordenador.request("DELETE", `/tasks/${task.id}`)).status, 403)

    assert.equal((await gerente.request("DELETE", `/tasks/${task.id}`)).status, 204)
    assert.equal((await gerente.request("GET", `/tasks/${task.id}`)).status, 404)
    assert.ok(!(await archivedIds()).includes(task.id))

    // Checklist, comentários e histórico saíram junto; a auditoria guarda o registro.
    const leftovers = await ctx.db.get<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM checklist_items WHERE task_id = ?) + (SELECT COUNT(*) FROM task_comments WHERE task_id = ?)
            + (SELECT COUNT(*) FROM task_events WHERE task_id = ?) AS n`,
      task.id,
      task.id,
      task.id
    )
    assert.equal(leftovers?.n, 0)
    const { entries } = await audit("?q=excluiu de vez")
    assert.equal(entries[0].taskId, task.id)
    assert.match(entries[0].summary, /excluiu de vez a tarefa TI-\d+ “Criada por engano”/)
  })
})

describe("auditoria", () => {
  it("todos veem; registra quem fez e descreve o que mudou", async () => {
    const task = await createTask(gerente, "Configurar impressora")
    await gerente.request("PATCH", `/tasks/${task.id}`, { priority: "high", title: "Configurar impressora do RH" })

    const { entries } = await audit("?area=tasks")
    const [edit, created] = entries
    assert.equal(edit.actorId, gerente.userId)
    assert.equal(edit.actorName, "gerente")
    assert.equal(edit.action, "task.updated")
    assert.match(edit.summary, /título \(“Configurar impressora” → “Configurar impressora do RH”\)/)
    assert.match(edit.summary, /prioridade \(Média → Alta\)/)
    assert.equal(created.action, "task.created")
    assert.match(created.summary, /^criou a tarefa TI-\d+ “Configurar impressora” — Chamado, prioridade Média, responsável gerente$/)
  })

  it("movimentação com motivo, checklist e login entram; reordenar na mesma coluna não", async () => {
    const task = await createTask(analista, "Cabo de rede")
    await analista.request("PATCH", `/tasks/${task.id}/checklist/${task.checklist[0].id}`, { isDone: true })
    await analista.request("POST", `/tasks/${task.id}/move`, { status: "blocked", reason: "Aguardando o fornecedor" })
    await analista.request("POST", `/tasks/${task.id}/move`, { status: "blocked", index: 0 })

    const mine = (await audit(`?actor=${analista.userId}`)).entries.map((e) => e.summary)
    assert.match(mine[0], /^moveu a tarefa TI-\d+ “Cabo de rede” de A fazer para Bloqueado — motivo: “Aguardando o fornecedor”$/)
    assert.match(mine[1], /^marcou o item “.+” em TI-\d+ “Cabo de rede”$/)
    assert.ok(mine.includes("entrou no sistema"))
  })

  it("filtra por período, pessoa, área e busca, e pagina", async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    assert.equal((await audit(`?since=${future}`)).entries.length, 0)
    const all = await audit("?limit=2")
    assert.equal(all.entries.length, 2)
    assert.equal(all.hasMore, true)
    const asc = await audit("?order=asc&limit=1")
    assert.equal(asc.entries[0].summary, "entrou no sistema")
    assert.ok((await audit("?area=access")).entries.every((e) => e.area === "access"))
    assert.ok((await audit("?q=impressora")).entries.every((e) => e.summary.includes("impressora")))
    assert.equal((await analista.request("GET", "/audit?area=xyz")).status, 422)
  })

  it("configurações do administrador entram, sem senha", async () => {
    const created = await gerente.request<{ user: { id: number }; temporaryPassword: string }>("POST", "/admin/users", {
      name: "Nova Pessoa",
      email: "nova@teste.local",
      role: "executor",
    })
    assert.equal(created.status, 201, JSON.stringify(created.body))
    await gerente.request("POST", `/admin/users/${created.body.user.id}/reset-password`)

    const { entries } = await audit("?area=users")
    assert.match(entries[0].summary, /^gerou uma nova senha para Nova Pessoa/)
    assert.equal(entries[1].summary, "cadastrou o usuário Nova Pessoa (nova@teste.local) como executor")
    assert.ok(entries.every((e) => !e.summary.includes(created.body.temporaryPassword)))
  })

  it("exige login", async () => {
    assert.equal((await ctx.raw("GET", "/audit")).status, 401)
  })
})
