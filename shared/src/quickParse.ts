import { TASK_PRIORITIES, type CategoryKey, type TaskPriority } from "./types"

/**
 * Lê a linha da criação rápida e separa o título dos atalhos:
 *   #categoria   → nome da categoria sem espaços (#infra, #chamado…)
 *   !prioridade  → !urgente, !alta, !media, !baixa
 *   @pessoa      → @juliana (primeiro nome, sem acento); vários @ = vários responsáveis
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
  /** Responsáveis pelos @, na ordem digitada; ausente se não houver nenhum @ reconhecido. */
  assigneeIds?: number[]
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

export interface QuickParseOptions {
  users: QuickParseUser[]
  /** Categorias ativas: casam pelo nome (sem espaços) ou pela chave. */
  categories?: { key: CategoryKey; name: string }[]
  /** Nomes personalizados das prioridades (os nomes padrão continuam valendo). */
  priorityLabels?: Partial<Record<TaskPriority, string>>
  today?: Date
}

export function parseQuickTask(input: string, options: QuickParseOptions): QuickParseResult {
  const today = options.today ?? new Date()
  const words = input.trim().split(/\s+/).filter(Boolean)
  const kept: string[] = []
  const result: QuickParseResult = { title: "", tokens: [] }

  const people: Record<string, number> = {}
  for (const u of options.users) people[normalize(u.name.split(" ")[0])] = u.id

  const categoryWords: Record<string, CategoryKey> = {}
  for (const c of options.categories ?? []) {
    categoryWords[normalize(c.key)] = c.key
    categoryWords[normalize(c.name).replace(/\s+/g, "")] = c.key
  }

  const priorityWords: Record<string, TaskPriority> = { ...PRIORITY_WORDS }
  for (const [priority, label] of Object.entries(options.priorityLabels ?? {}) as [TaskPriority, string][]) {
    priorityWords[normalize(label).replace(/\s+/g, "")] = priority
  }

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const head = word[0]
    const body = normalize(word.slice(1))

    if (head === "#" && !result.category) {
      const category = matchPrefix(body, categoryWords)
      if (category) {
        result.category = category
        result.tokens.push(word)
        continue
      }
    }
    if (head === "!" && !result.priority) {
      const priority = matchPrefix(body, priorityWords)
      if (priority) {
        result.priority = priority
        result.tokens.push(word)
        continue
      }
    }
    if (head === "@") {
      const id = matchPrefix(body, people)
      if (id !== undefined) {
        // Repetir a mesma pessoa não duplica.
        if (!result.assigneeIds?.includes(id)) result.assigneeIds = [...(result.assigneeIds ?? []), id]
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

/* ───────────────────────── sugestões enquanto digita ───────────────────────── */

export type QuickSuggestionKind = "category" | "priority" | "assignee"

export interface QuickSuggestion {
  kind: QuickSuggestionKind
  /** Chave da categoria, prioridade ou id da pessoa (como texto). */
  value: string
  /** Atalho completo que entra no campo, ex.: "#chamado". */
  token: string
  label: string
}

export interface QuickSuggestions {
  /** Trecho do texto (início/fim) que a sugestão escolhida substitui. */
  start: number
  end: number
  items: QuickSuggestion[]
}

const PRIORITY_DEFAULT_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
}

const tokenWord = (s: string) => normalize(s).replace(/\s+/g, "")

/**
 * Sugestões para o atalho que está sendo digitado onde está o cursor (#, ! ou @).
 * Os atalhos sugeridos são os mesmos que `parseQuickTask` reconhece. Retorna null
 * quando o cursor não está num atalho ou quando ele já está escrito por inteiro.
 */
export function quickSuggestions(input: string, caret: number, options: QuickParseOptions, limit = 6): QuickSuggestions | null {
  const before = input.slice(0, caret)
  const start = before.search(/\S*$/)
  const rest = input.slice(caret).search(/\s|$/)
  const end = caret + rest
  const word = input.slice(start, end)
  const head = word[0]
  if (head !== "#" && head !== "!" && head !== "@") return null
  const typed = normalize(word.slice(1))

  let items: (QuickSuggestion & { words: string[] })[]
  if (head === "#") {
    items = (options.categories ?? []).map((c) => ({
      kind: "category" as const,
      value: c.key,
      token: `#${tokenWord(c.name)}`,
      label: c.name,
      words: [tokenWord(c.name), normalize(c.key)],
    }))
  } else if (head === "!") {
    items = TASK_PRIORITIES.map((p) => {
      const label = options.priorityLabels?.[p] ?? PRIORITY_DEFAULT_LABELS[p]
      return {
        kind: "priority" as const,
        value: p,
        token: `!${tokenWord(label)}`,
        label,
        words: [tokenWord(label), normalize(PRIORITY_DEFAULT_LABELS[p])],
      }
    })
  } else {
    items = options.users.map((u) => ({
      kind: "assignee" as const,
      value: String(u.id),
      token: `@${normalize(u.name.split(" ")[0])}`,
      label: u.name,
      words: normalize(u.name).split(/\s+/),
    }))
  }

  const matches = items.filter((item) => item.words.some((w) => w.startsWith(typed)))
  // Atalho já completo: nada a sugerir (Enter volta a criar a tarefa).
  if (matches.some((item) => item.token === `${head}${typed}`)) return null
  if (matches.length === 0) return null
  return { start, end, items: matches.slice(0, limit).map(({ words: _words, ...item }) => item) }
}
