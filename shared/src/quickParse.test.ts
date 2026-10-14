import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { parseQuickTask } from "./quickParse"

const users = [
  { id: 1, name: "Marcos Almeida" },
  { id: 2, name: "Rafael Lima" },
  { id: 3, name: "Juliana Souza" },
]
const categories = [
  { key: "ticket", name: "Chamado" },
  { key: "infra", name: "Infra" },
  { key: "purchase", name: "Compra" },
  { key: "project", name: "Projeto" },
  { key: "routine", name: "Rotina" },
  { key: "telefonia-ip", name: "Telefonia IP" },
]
// Terça-feira, 13/10/2026
const today = new Date(2026, 9, 13)
const parse = (s: string) => parseQuickTask(s, { users, categories, today })

describe("parseQuickTask", () => {
  it("separa título e atalhos", () => {
    const r = parse("Trocar toner da impressora do RH #infra !alta @juliana amanhã")
    assert.equal(r.title, "Trocar toner da impressora do RH")
    assert.equal(r.category, "infra")
    assert.equal(r.priority, "high")
    assert.equal(r.assigneeId, 3)
    assert.equal(r.dueDate, "2026-10-14")
    assert.deepEqual(r.tokens, ["#infra", "!alta", "@juliana", "amanhã"])
  })

  it("só título, sem atalhos", () => {
    const r = parse("  Configurar VPN do novo gerente  ")
    assert.deepEqual(r, { title: "Configurar VPN do novo gerente", tokens: [] })
  })

  it("aceita prefixos e ignora acentos e maiúsculas", () => {
    const r = parse("Cotação #COMP !urg @RAF")
    assert.equal(r.category, "purchase")
    assert.equal(r.priority, "urgent")
    assert.equal(r.assigneeId, 2)
    assert.equal(parse("x !média").priority, "medium")
  })

  it("prefixo ambíguo ou desconhecido fica no título", () => {
    const r = parse("Ver #xyz e !super")
    assert.equal(r.title, "Ver #xyz e !super")
    assert.equal(r.category, undefined)
  })

  it("datas relativas e dias da semana", () => {
    assert.equal(parse("x hoje").dueDate, "2026-10-13")
    assert.equal(parse("x depois de amanhã").dueDate, "2026-10-15")
    assert.equal(parse("x sexta").dueDate, "2026-10-16")
    assert.equal(parse("x na segunda").dueDate, "2026-10-19")
    // mesmo dia da semana de hoje = semana que vem
    assert.equal(parse("x terça").dueDate, "2026-10-20")
    assert.equal(parse("Reunião na sexta").title, "Reunião")
  })

  it("datas dd/mm e dd/mm/aaaa", () => {
    assert.equal(parse("x 20/10").dueDate, "2026-10-20")
    assert.equal(parse("x 05/01").dueDate, "2027-01-05", "data já passada vai para o ano seguinte")
    assert.equal(parse("x 31/12/2026").dueDate, "2026-12-31")
    assert.equal(parse("x 31/02").dueDate, undefined)
  })

  it("só o primeiro atalho de cada tipo vale", () => {
    const r = parse("x #infra #compra")
    assert.equal(r.category, "infra")
    assert.equal(r.title, "x #compra")
  })
})

describe("categorias e prioridades personalizadas", () => {
  it("casa categoria nova pelo nome sem espaços ou pela chave", () => {
    assert.equal(parse("Ramal mudo #telefoniaip").category, "telefonia-ip")
    assert.equal(parse("Ramal mudo #telefonia-ip").category, "telefonia-ip")
    assert.equal(parse("Ramal mudo #tel").category, "telefonia-ip")
  })

  it("aceita o nome personalizado da prioridade e mantém os padrões", () => {
    const opts = { users, categories, today, priorityLabels: { urgent: "Crítica" } }
    assert.equal(parseQuickTask("x !critica", opts).priority, "urgent")
    assert.equal(parseQuickTask("x !urgente", opts).priority, "urgent")
  })
})
