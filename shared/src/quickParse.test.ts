import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { parseQuickTask, quickSuggestions, type QuickParseOptions } from "./quickParse"

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

describe("quickSuggestions", () => {
  const opts: QuickParseOptions = { users, categories, today }
  const at = (text: string, options = opts) => quickSuggestions(text, text.length, options)
  const tokens = (text: string, options = opts) => at(text, options)?.items.map((i) => i.token)

  it("só # mostra as categorias, na ordem de Configurações", () => {
    assert.deepEqual(tokens("Trocar mouse #"), ["#chamado", "#infra", "#compra", "#projeto", "#rotina", "#telefoniaip"])
  })

  it("filtra pelo começo do nome ou da chave, sem acento nem maiúscula", () => {
    assert.deepEqual(tokens("x #CH"), ["#chamado"])
    assert.deepEqual(tokens("x #tick"), ["#chamado"])
    assert.deepEqual(tokens("x #tel"), ["#telefoniaip"])
  })

  it("informa o trecho a substituir, mesmo com o cursor no meio do atalho", () => {
    const text = "Trocar #inf mouse"
    assert.deepEqual(quickSuggestions(text, 9, opts), {
      start: 7,
      end: 11,
      items: [{ kind: "category", value: "infra", token: "#infra", label: "Infra" }],
    })
  })

  it("sugere prioridades (com nomes personalizados) e pessoas", () => {
    assert.deepEqual(tokens("x !"), ["!urgente", "!alta", "!media", "!baixa"])
    assert.deepEqual(tokens("x !crit", { ...opts, priorityLabels: { urgent: "Crítica" } }), ["!critica"])
    assert.deepEqual(tokens("x @ju"), ["@juliana"])
    // Pelo sobrenome também, mas o atalho é o primeiro nome.
    assert.deepEqual(tokens("x @lim"), ["@rafael"])
  })

  it("nada a sugerir fora de atalho, sem resultado ou com o atalho já completo", () => {
    assert.equal(at("Trocar mouse"), null)
    assert.equal(at("x #zzz"), null)
    assert.equal(at("x #infra"), null)
    assert.equal(at("x #infra "), null)
  })

  it("o atalho sugerido é reconhecido pelo parseQuickTask", () => {
    for (const s of at("x #")!.items) assert.equal(parseQuickTask(`x ${s.token}`, opts).category, s.value)
    for (const s of at("x !")!.items) assert.equal(parseQuickTask(`x ${s.token}`, opts).priority, s.value)
    for (const s of at("x @")!.items) assert.equal(String(parseQuickTask(`x ${s.token}`, opts).assigneeId), s.value)
  })
})
