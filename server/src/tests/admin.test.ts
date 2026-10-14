import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import type { AdminUserDTO, CategoryDTO, TaskDetailDTO } from "@tarefas/shared"

import { startTestServer, TEST_PASSWORD, type ApiClient } from "./helpers"

let ctx: Awaited<ReturnType<typeof startTestServer>>
let admin: ApiClient
let gestor: ApiClient
let analista: ApiClient

before(async () => {
  ctx = await startTestServer()
  admin = await ctx.login("gerente")
  gestor = await ctx.login("coordenador")
  analista = await ctx.login("analista")
})
after(() => ctx.close())

describe("acesso às configurações", () => {
  it("só o administrador entra", async () => {
    assert.equal((await admin.request("GET", "/admin/users")).status, 200)
    assert.equal((await gestor.request("GET", "/admin/users")).status, 403)
    assert.equal((await analista.request("PATCH", "/admin/settings", { appName: "X" })).status, 403)
  })

  it("/me informa quem é administrador", async () => {
    assert.equal((await admin.request("GET", "/auth/me")).body.user.isAdmin, true)
    assert.equal((await gestor.request("GET", "/auth/me")).body.user.isAdmin, false)
  })
})

describe("usuários", () => {
  it("cria com senha temporária que funciona no login", async () => {
    const res = await admin.request<{ user: AdminUserDTO; temporaryPassword: string }>("POST", "/admin/users", {
      name: "Nova Pessoa",
      email: "Nova@Teste.local",
      role: "executor",
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.user.email, "nova@teste.local")
    assert.equal(res.body.temporaryPassword.length, 12)
    const login = await ctx.raw("POST", "/auth/login", { email: "nova@teste.local", password: res.body.temporaryPassword })
    assert.equal(login.status, 200)
  })

  it("recusa e-mail repetido", async () => {
    const res = await admin.request("POST", "/admin/users", { name: "Outra", email: "analista@teste.local", role: "executor" })
    assert.equal(res.status, 409)
  })

  it("executor nunca vira administrador", async () => {
    const res = await admin.request<{ user: AdminUserDTO }>("PATCH", `/admin/users/${ctx.users.analista.id}`, { isAdmin: true })
    assert.equal(res.body.user.isAdmin, false)
  })

  it("administrador não se desativa nem tira o próprio acesso", async () => {
    const me = ctx.users.gerente.id
    assert.equal((await admin.request("PATCH", `/admin/users/${me}`, { isActive: false })).status, 409)
    assert.equal((await admin.request("PATCH", `/admin/users/${me}`, { isAdmin: false })).status, 409)
  })

  it("desativar encerra a sessão da pessoa", async () => {
    const created = await admin.request<{ user: AdminUserDTO; temporaryPassword: string }>("POST", "/admin/users", {
      name: "Temporária",
      email: "temp@teste.local",
      role: "manager",
    })
    const login = await ctx.raw("POST", "/auth/login", { email: "temp@teste.local", password: created.body.temporaryPassword })
    const cookie = login.setCookie[0].split(";")[0]
    assert.equal((await ctx.raw("GET", "/tasks", undefined, cookie)).status, 200)

    await admin.request("PATCH", `/admin/users/${created.body.user.id}`, { isActive: false })
    assert.equal((await ctx.raw("GET", "/tasks", undefined, cookie)).status, 401)
    const again = await ctx.raw("POST", "/auth/login", { email: "temp@teste.local", password: created.body.temporaryPassword })
    assert.equal(again.status, 401)
  })

  it("redefinir senha gera uma nova que funciona", async () => {
    const res = await admin.request<{ temporaryPassword: string }>("POST", `/admin/users/${ctx.users.bloqueado.id}/reset-password`)
    assert.equal(res.status, 200)
    const login = await ctx.raw("POST", "/auth/login", { email: "bloqueado@teste.local", password: res.body.temporaryPassword })
    assert.equal(login.status, 200)
  })
})

describe("troca da própria senha", () => {
  it("exige a senha atual e aceita a nova", async () => {
    const pessoa = await ctx.login("analista")
    const errada = await pessoa.request("POST", "/auth/password", { currentPassword: "x", newPassword: "nova-senha-123" })
    assert.equal(errada.status, 422)
    const curta = await pessoa.request("POST", "/auth/password", { currentPassword: TEST_PASSWORD, newPassword: "123" })
    assert.equal(curta.status, 422)
    const ok = await pessoa.request("POST", "/auth/password", { currentPassword: TEST_PASSWORD, newPassword: "nova-senha-123" })
    assert.equal(ok.status, 204)
    assert.equal((await pessoa.request("GET", "/auth/me")).status, 200, "a sessão atual continua")
    const login = await ctx.raw("POST", "/auth/login", { email: "analista@teste.local", password: "nova-senha-123" })
    assert.equal(login.status, 200)
    // Volta a senha e refaz o login: trocar a senha encerra as outras sessões da pessoa.
    await pessoa.request("POST", "/auth/password", { currentPassword: "nova-senha-123", newPassword: TEST_PASSWORD })
    assert.equal((await analista.request("GET", "/auth/me")).status, 401, "a sessão antiga foi encerrada")
    analista = await ctx.login("analista")
  })
})

describe("categorias", () => {
  it("cria com checklist padrão, e tarefas novas recebem esse checklist", async () => {
    const res = await admin.request<{ category: CategoryDTO }>("POST", "/admin/categories", {
      name: "Telefonia IP",
      icon: "phone",
      checklistTemplate: ["Ramal testado", "Usuário orientado"],
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.category.key, "telefonia-ip")

    const task = await analista.request<{ task: TaskDetailDTO }>("POST", "/tasks", { title: "Ramal mudo", category: "telefonia-ip" })
    assert.deepEqual(
      task.body.task.checklist.map((i) => i.label),
      ["Ramal testado", "Usuário orientado"]
    )
  })

  it("categoria sem itens gera card com checklist vazio", async () => {
    await admin.request("POST", "/admin/categories", { name: "Outros", icon: "tag" })
    const task = await analista.request<{ task: TaskDetailDTO }>("POST", "/tasks", { title: "Livre", category: "outros" })
    assert.equal(task.body.task.checklist.length, 0)
  })

  it("editar o modelo não mexe nas tarefas que já existem", async () => {
    const before = await analista.request<{ task: TaskDetailDTO }>("POST", "/tasks", { title: "Antes", category: "telefonia-ip" })
    await admin.request("PATCH", "/admin/categories/telefonia-ip", { checklistTemplate: ["Só um item"] })
    const detail = await analista.request<{ task: TaskDetailDTO }>("GET", `/tasks/${before.body.task.id}`)
    assert.equal(detail.body.task.checklist.length, 2)
  })

  it("não exclui categoria em uso (pede para desativar) e desativada não aceita tarefas novas", async () => {
    const del = await admin.request("DELETE", "/admin/categories/telefonia-ip")
    assert.equal(del.status, 409)
    assert.match(del.body.error.message, /Desative/)

    await admin.request("PATCH", "/admin/categories/telefonia-ip", { isActive: false })
    const create = await analista.request("POST", "/tasks", { title: "x", category: "telefonia-ip" })
    assert.equal(create.status, 422)

    const list = await analista.request<{ categories: CategoryDTO[] }>("GET", "/categories")
    assert.equal(list.body.categories.find((c) => c.key === "telefonia-ip")?.isActive, false, "continua listada para exibir tarefas antigas")
  })

  it("exclui categoria sem tarefas", async () => {
    await admin.request("POST", "/admin/categories", { name: "Descartável", icon: "tag" })
    assert.equal((await admin.request("DELETE", "/admin/categories/descartavel")).status, 204)
  })

  it("recusa nome repetido", async () => {
    const res = await admin.request("POST", "/admin/categories", { name: "infra", icon: "tag" })
    assert.equal(res.status, 409)
  })
})

describe("configurações gerais", () => {
  it("são públicas para leitura e o administrador altera", async () => {
    const pub = await ctx.raw("GET", "/settings")
    assert.equal(pub.status, 200)
    assert.equal(pub.body.settings.appName, "Tarefas TI")

    const res = await admin.request("PATCH", "/admin/settings", {
      appName: "Quadro do TI",
      brandColor: "#0EA5E9",
      statusLabels: { review: "Conferência" },
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.settings.brandColor, "#0ea5e9")
    assert.equal(res.body.settings.statusLabels.todo, "A fazer", "o que não veio fica como estava")
  })

  it("as regras passam a usar os nomes e o motivo mínimo configurados", async () => {
    await admin.request("PATCH", "/admin/settings", { reasonMinLength: 12 })
    const task = await analista.request<{ task: TaskDetailDTO }>("POST", "/tasks", { title: "Regras", category: "ticket" })
    const review = await analista.request("POST", `/tasks/${task.body.task.id}/move`, { status: "review" })
    assert.match(review.body.error.message, /para enviar para Conferência/)

    const curto = await analista.request("POST", `/tasks/${task.body.task.id}/move`, { status: "blocked", reason: "aguardando" })
    assert.equal(curto.status, 422)
    const ok = await analista.request("POST", `/tasks/${task.body.task.id}/move`, {
      status: "blocked",
      reason: "aguardando a peça",
    })
    assert.equal(ok.status, 200)
  })

  it("valida a cor", async () => {
    assert.equal((await admin.request("PATCH", "/admin/settings", { brandColor: "roxo" })).status, 422)
  })
})

describe("comentários", () => {
  it("qualquer pessoa comenta; só o autor edita; autor ou administrador exclui", async () => {
    const task = await analista.request<{ task: TaskDetailDTO }>("POST", "/tasks", { title: "Com comentários", category: "ticket" })
    const id = task.body.task.id

    const c1 = await analista.request("POST", `/tasks/${id}/comments`, { body: "Liguei para o fornecedor." })
    assert.equal(c1.status, 201)
    const c2 = await gestor.request("POST", `/tasks/${id}/comments`, { body: "Ok, aguardo retorno." })

    assert.equal((await gestor.request("PATCH", `/tasks/${id}/comments/${c1.body.comment.id}`, { body: "x" })).status, 403)
    const edit = await analista.request("PATCH", `/tasks/${id}/comments/${c1.body.comment.id}`, { body: "Liguei e abri protocolo 123." })
    assert.equal(edit.body.comment.body, "Liguei e abri protocolo 123.")

    assert.equal((await analista.request("DELETE", `/tasks/${id}/comments/${c2.body.comment.id}`)).status, 403)
    assert.equal((await admin.request("DELETE", `/tasks/${id}/comments/${c2.body.comment.id}`)).status, 204)

    const detail = await analista.request<{ task: TaskDetailDTO }>("GET", `/tasks/${id}`)
    assert.equal(detail.body.task.comments.length, 1)
    assert.equal(detail.body.task.commentCount, 1)
  })

  it("recusa comentário vazio", async () => {
    const task = await analista.request<{ task: TaskDetailDTO }>("POST", "/tasks", { title: "Vazio", category: "ticket" })
    const res = await analista.request("POST", `/tasks/${task.body.task.id}/comments`, { body: "   " })
    assert.equal(res.status, 422)
  })
})
