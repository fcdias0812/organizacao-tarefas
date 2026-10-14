import type { CategoryKey, TaskPriority } from "./types"

/**
 * Lê a linha da criação rápida e separa o título dos atalhos:
 *   #categoria   → #infra, #chamado, #compra, #projeto, #rotina
 *   !prioridade  → !urgente, !alta, !media, !baixa
 *   @pessoa      → @juliana (primeiro nome, sem acento)
 *   prazo        → hoje, amanhã, depois de amanhã, segunda…domingo, 15/10, 15/10/2026
 * Atalhos não reconhecidos ficam no título.
 */

export interface QuickParseUser {
  id: number
  name: string
}

export interface QuickParseResult {
  title: string
  category?: CategoryKey
  priority?: TaskPriority
  assigneeId?: number
  /** AAAA-MM-DD */
  dueDate?: string
  /** Trechos reconhecidos, para destacar na interface. */
  tokens: string[]
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

const CATEGORY_WORDS: Record<string, CategoryKey> = {
  chamado: "ticket",
  infra: "infra",
  infraestrutura: "infra",
  compra: "purchase",
  compras: "purchase",
  projeto: "project",
  rotina: "routine",
}

const PRIORITY_WORDS: Record<string, TaskPriority> = {
  urgente: "urgent",
  alta: "high",
  media: "medium",
  baixa: "low",
}

/** Aceita prefixos: #inf, !urg, @jul. */
function matchPrefix<T>(word: string, table: Record<string, T>): T | undefined {
  if (!word) return undefined
  if (word in table) return table[word]
  const hits = Object.keys(table).filter((k) => k.startsWith(word))
  const values = new Set(hits.map((k) => table[k]))
  return values.size === 1 ? table[hits[0]] : undefined
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, seg: 1, "segunda-feira": 1,
  terca: 2, ter: 2, "terca-feira": 2,
  quarta: 3, qua: 3, "quarta-feira": 3,
  quinta: 4, qui: 4, "quinta-feira": 4,
  sexta: 5, sex: 5, "sexta-feira": 5,
  sabado: 6, sab: 6,
}

function toDateOnly(d: Date): string {
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, "0")).join("-")
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  d.setDate(d.getDate() + days)
  return d
}

/** Tenta ler uma data a partir de `words[i]`; retorna a data e quantas palavras usou. */
function readDate(words: string[], i: number, today: Date): { date: string; used: number } | undefined {
  const w = normalize(words[i])
  const next = words[i + 1] ? normalize(words[i + 1]) : ""
  const third = words[i + 2] ? normalize(words[i + 2]) : ""

  if (w === "depois" && next === "de" && third === "amanha") return { date: toDateOnly(addDays(today, 2)), used: 3 }
  if (w === "hoje") return { date: toDateOnly(today), used: 1 }
  if (w === "amanha") return { date: toDateOnly(addDays(today, 1)), used: 1 }

  // "sexta" ou "na sexta": próxima ocorrência (nunca hoje).
  const dayWord = w === "na" || w === "no" ? next : w
  if (dayWord in WEEKDAYS) {
    const ahead = (WEEKDAYS[dayWord] - today.getDay() + 7) % 7 || 7
    return { date: toDateOnly(addDays(today, ahead)), used: dayWord === w ? 1 : 2 }
  }

  // 15/10 ou 15/10/2026 (sem ano: próxima vez que essa data acontecer)
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(w)
  if (m) {
    const day = Number(m[1])
    const month = Number(m[2]) - 1
    let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : today.getFullYear()
    let date = new Date(year, month, day)
    if (date.getMonth() !== month || date.getDate() !== day) return undefined
    if (!m[3] && date < addDays(today, 0)) {
      year += 1
      date = new Date(year, month, day)
    }
    return { date: toDateOnly(date), used: 1 }
  }
  return undefined
}

export function parseQuickTask(input: string, options: { users: QuickParseUser[]; today?: Date }): QuickParseResult {
  const today = options.today ?? new Date()
  const words = input.trim().split(/\s+/).filter(Boolean)
  const kept: string[] = []
  const result: QuickParseResult = { title: "", tokens: [] }

  const people: Record<string, number> = {}
  for (const u of options.users) people[normalize(u.name.split(" ")[0])] = u.id

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const head = word[0]
    const body = normalize(word.slice(1))

    if (head === "#" && !result.category) {
      const category = matchPrefix(body, CATEGORY_WORDS)
      if (category) {
        result.category = category
        result.tokens.push(word)
        continue
      }
    }
    if (head === "!" && !result.priority) {
      const priority = matchPrefix(body, PRIORITY_WORDS)
      if (priority) {
        result.priority = priority
        result.tokens.push(word)
        continue
      }
    }
    if (head === "@" && result.assigneeId === undefined) {
      const id = matchPrefix(body, people)
      if (id !== undefined) {
        result.assigneeId = id
        result.tokens.push(word)
        continue
      }
    }
    if (!result.dueDate) {
      const date = readDate(words, i, today)
      if (date) {
        result.dueDate = date.date
        result.tokens.push(words.slice(i, i + date.used).join(" "))
        i += date.used - 1
        continue
      }
    }
    kept.push(word)
  }

  result.title = kept.join(" ")
  return result
}
