import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import type { TaskDetailDTO } from "@tarefas/shared"

import { startTestServer, TEST_PASSWORD, type ApiClient } from "./helpers"

let ctx: Awaited<ReturnType<typeof startTestServer>>
let gerente: ApiClient
let analista: ApiClient

before(async () => {
  ctx = await startTestServer()
  gerente = await ctx.login("gerente")
  analista = await ctx.login("analista")
})
after(() => ctx.close())

async function createTask(client: ApiClient, body: Record<string, unknown> = {}) {
  const res = await client.request<{ task: TaskDetailDTO }>("POST", "/tasks", {
    title: "Configurar impressora",
    category: "ticket",
    ...body,
  })
  assert.equal(res.status, 201, JSON.stringify(res.body))
  return res.body.task
}

async function checkAll(client: ApiClient, task: TaskDetailDTO) {
  for (const item of task.checklist) {
    const res = await client.request("PATCH", `/tasks/${task.id}/checklist/${item.id}`, { isDone: true })
    assert.equal(res.status, 200)
  }
}

const move = (client: ApiClient, id: number, body: Record<string, unknown>) =>
  client.request("POST", `/tasks/${id}/move`, body)

const detail = async (id: number) =>
  (await gerente.request<{ task: TaskDetailDTO }>("GET", `/tasks/${id}`)).body.task

describe("autenticação", () => {
  it("recusa senha errada sem dizer se o e-mail existe", async () => {
    const wrongPass = await ctx.raw("POST", "/auth/login", { email: "gerente@teste.local", password: "x" })
    const unknown = await ctx.raw("POST", "/auth/login", { email: "ninguem@teste.local", password: "x" })
    assert.equal(wrongPass.status, 401)
    assert.equal(unknown.status, 401)
    assert.equal(wrongPass.body.error.message, unknown.body.error.message)
  })

  it("login cria cookie httpOnly e /me devolve o usuário", async () => {
    const res = await ctx.raw("POST", "/auth/login", { email: "GERENTE@teste.local", password: TEST_PASSWORD })
    assert.equal(res.status, 200)
    assert.match(res.setCookie[0], /HttpOnly/i)
    assert.match(res.setCookie[0], /SameSite=Lax/i)
    assert.equal(res.body.user.role, "manager")
    assert.equal(res.body.user.password_hash, undefined)

    const me = await gerente.request("GET", "/auth/me")
    assert.equal(me.body.user.email, "gerente@teste.local")
  })

  it("bloqueia depois de muitas tentativas erradas", async () => {
    const attempt = () => ctx.raw("POST", "/auth/login", { email: "bloqueado@teste.local", password: "errada" })
    for (let i = 0; i < 8; i++) assert.equal((await attempt()).status, 401)
    const blocked = await attempt()
    assert.equal(blocked.status, 429)
    assert.match(blocked.body.error.message, /Muitas tentativas/)
    // Nem a senha certa entra enquanto estiver bloqueado.
    const right = await ctx.raw("POST", "/auth/login", { email: "bloqueado@teste.local", password: TEST_PASSWORD })
    assert.equal(right.status, 429)
  })

  it("respostas trazem cabeçalhos de segurança", async () => {
    const res = await fetch(`${ctx.baseUrl}/auth/me`)
    assert.equal(res.headers.get("x-content-type-options"), "nosniff")
    assert.equal(res.headers.get("x-frame-options"), "DENY")
  })

  it("rotas exigem login", async () => {
    const res = await ctx.raw("GET", "/tasks")
    assert.equal(res.status, 401)
  })

  it("logout invalida a sessão", async () => {
    const temp = await ctx.login("coordenador")
    assert.equal((await temp.request("POST", "/auth/logout")).status, 204)
    assert.equal((await temp.request("GET", "/tasks")).status, 401)
  })

  it("mutações só aceitam JSON", async () => {
    const res = await fetch(`${ctx.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "title=x&category=ticket",
    })
    assert.equal(res.status, 415)
  })
})

describe("criação de tarefa", () => {
  it("copia o checklist padrão da categoria e registra quem criou", async () => {
    const task = await createTask(analista)
    assert.equal(task.status, "todo")
    assert.equal(task.assigneeId, analista.userId, "sem responsável informado, fica com quem criou")
    assert.deepEqual(
      task.checklist.map((i) => i.label),
      [
        "Problema entendido e reproduzido",
        "Solução aplicada",
        "Usuário confirmou que resolveu",
        "Registro encerrado e documentado",
      ]
    )
    assert.ok(task.checklist.every((i) => i.isFromTemplate && !i.isDone))
    assert.equal(task.events[0].type, "created")
    assert.equal(task.events[0].actorId, analista.userId)
  })

  it("executor não atribui para outra pessoa; gestor sim", async () => {
    const res = await analista.request("POST", "/tasks", {
      title: "X",
      category: "infra",
      assigneeId: ctx.users.gerente.id,
    })
    assert.equal(res.status, 403)

    const task = await createTask(gerente, { assigneeId: ctx.users.analista.id })
    assert.equal(task.assigneeId, ctx.users.analista.id)
  })

  it("valida os campos com mensagens em português", async () => {
    const res = await gerente.request("POST", "/tasks", { title: "  ", category: "ticket" })
    assert.equal(res.status, 422)
    assert.equal(res.body.error.message, "Informe um título.")
  })

  it("trocar a categoria troca os itens padrão e mantém os avulsos", async () => {
    const task = await createTask(gerente)
    await gerente.request("POST", `/tasks/${task.id}/checklist`, { label: "Item avulso" })
    const res = await gerente.request<{ task: TaskDetailDTO }>("PATCH", `/tasks/${task.id}`, { category: "routine" })
    assert.equal(res.status, 200)
    assert.deepEqual(
      res.body.task.checklist.map((i) => i.label),
      ["Executada conforme o procedimento", "Evidência registrada", "Anomalias reportadas", "Item avulso"]
    )
  })
})

describe("fluxo de qualidade", () => {
  it("não vai para Revisão com checklist incompleto", async () => {
    const task = await createTask(analista)
    await analista.request("PATCH", `/tasks/${task.id}/checklist/${task.checklist[0].id}`, { isDone: true })
    const res = await move(analista, task.id, { status: "review" })
    assert.equal(res.status, 409)
    assert.equal(res.body.error.code, "checklist_incomplete")
    assert.equal(res.body.error.message, "Faltam 3 itens do checklist para enviar para Revisão.")
  })

  it("Revisão → Concluído só pelo gestor, com histórico completo", async () => {
    const task = await createTask(analista)
    await move(analista, task.id, { status: "in_progress" })
    await checkAll(analista, task)
    assert.equal((await move(analista, task.id, { status: "review" })).status, 200)

    const denied = await move(analista, task.id, { status: "done" })
    assert.equal(denied.status, 403)

    const approved = await move(gerente, task.id, { status: "done" })
    assert.equal(approved.status, 200)
    assert.equal(approved.body.task.status, "done")
    assert.ok(approved.body.task.completedAt)

    const types = (await detail(task.id)).events.map((e) => e.type)
    assert.deepEqual(types, ["created", "moved", "sent_to_review", "approved"])
  })

  it("o coordenador (também gestor) aprova", async () => {
    const coordenador = await ctx.login("coordenador")
    const task = await createTask(analista)
    await checkAll(analista, task)
    await move(analista, task.id, { status: "review" })
    assert.equal((await move(coordenador, task.id, { status: "done" })).status, 200)
  })

  it("devolver exige motivo, mantém o checklist marcado e registra o motivo", async () => {
    const task = await createTask(analista)
    await checkAll(analista, task)
    await move(analista, task.id, { status: "review" })

    const semMotivo = await move(gerente, task.id, { status: "in_progress" })
    assert.equal(semMotivo.status, 422)

    const res = await move(gerente, task.id, { status: "in_progress", reason: "Faltou testar no ramal 214" })
    assert.equal(res.status, 200)
    assert.equal(res.body.task.lastReturnReason, "Faltou testar no ramal 214")
    assert.equal(res.body.task.checklistDone, res.body.task.checklistTotal)

    const returned = (await detail(task.id)).events.at(-1)!
    assert.equal(returned.type, "returned")
    assert.equal(returned.reason, "Faltou testar no ramal 214")
    assert.equal(returned.actorId, gerente.userId)

    // Ao voltar para a Revisão, o aviso de devolução some (o histórico fica).
    const again = await move(analista, task.id, { status: "review" })
    assert.equal(again.body.task.lastReturnReason, null)
  })

  it("executor não tira card da Revisão", async () => {
    const task = await createTask(analista)
    await checkAll(analista, task)
    await move(analista, task.id, { status: "review" })
    const res = await move(analista, task.id, { status: "in_progress", reason: "mudei de ideia" })
    assert.equal(res.status, 403)
  })

  it("bloquear exige motivo; desbloquear limpa o motivo", async () => {
    const task = await createTask(analista)
    assert.equal((await move(analista, task.id, { status: "blocked" })).status, 422)

    const blocked = await move(analista, task.id, { status: "blocked", reason: "Aguardando peça" })
    assert.equal(blocked.body.task.blockedReason, "Aguardando peça")

    const unblocked = await move(analista, task.id, { status: "in_progress" })
    assert.equal(unblocked.status, 200)
    assert.equal(unblocked.body.task.blockedReason, null)
  })

  it("checklist fica travado durante a Revisão", async () => {
    const task = await createTask(analista)
    await checkAll(analista, task)
    await move(analista, task.id, { status: "review" })
    const res = await analista.request("PATCH", `/tasks/${task.id}/checklist/${task.checklist[0].id}`, {
      isDone: false,
    })
    assert.equal(res.status, 409)
  })

  it("executor não remove item padrão, mas remove o que ele adicionou", async () => {
    const task = await createTask(analista)
    const padrao = await analista.request("DELETE", `/tasks/${task.id}/checklist/${task.checklist[0].id}`)
    assert.equal(padrao.status, 403)

    const added = await analista.request("POST", `/tasks/${task.id}/checklist`, { label: "Testar no celular" })
    assert.equal(added.status, 201)
    const removed = await analista.request("DELETE", `/tasks/${task.id}/checklist/${added.body.item.id}`)
    assert.equal(removed.status, 204)

    assert.equal((await gerente.request("DELETE", `/tasks/${task.id}/checklist/${task.checklist[0].id}`)).status, 204)
  })
})

describe("ordenação", () => {
  it("move para a posição pedida dentro da coluna", async () => {
    const a = await createTask(gerente, { title: "A" })
    const b = await createTask(gerente, { title: "B" })
    const c = await createTask(gerente, { title: "C" })
    for (const t of [a, b, c]) await move(gerente, t.id, { status: "in_progress" })
    // Ordem atual em andamento (fim da coluna a cada movimento): ..., A, B, C
    await move(gerente, c.id, { status: "in_progress", index: 0 })

    const list = (await gerente.request("GET", "/tasks")).body.tasks as { id: number; status: string }[]
    const column = list.filter((t) => t.status === "in_progress").map((t) => t.id)
    assert.equal(column[0], c.id)
    assert.ok(column.indexOf(a.id) < column.indexOf(b.id))

    // Reordenar na mesma coluna não polui o histórico.
    assert.equal((await detail(c.id)).events.filter((e) => e.type === "moved").length, 1)
  })
})
