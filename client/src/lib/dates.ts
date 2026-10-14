export type DueState = "overdue" | "soon" | "normal"

const DAY_MS = 24 * 60 * 60 * 1000

/** Converte "AAAA-MM-DD" em Date local (meia-noite), sem deslocamento de fuso. */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function toDateOnly(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Dias entre hoje e o prazo (negativo = vencido). */
export function daysUntil(dueDate: string, now = new Date()): number {
  return Math.round((parseDateOnly(dueDate).getTime() - startOfDay(now).getTime()) / DAY_MS)
}

/** `soonDays`: quantos dias antes do prazo o card fica âmbar (configurável). */
export function getDueState(dueDate: string, now = new Date(), soonDays = 2): DueState {
  const days = daysUntil(dueDate, now)
  if (days < 0) return "overdue"
  if (days <= soonDays) return "soon"
  return "normal"
}

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" })
const longDate = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})

/** "15 out" */
export function formatShortDate(dueDate: string): string {
  return shortDate.format(parseDateOnly(dueDate)).replace(" de ", " ").replace(".", "")
}

export function formatLongDate(dueDate: string): string {
  return longDate.format(parseDateOnly(dueDate))
}

/** Rótulo amigável do prazo para o card. */
export function formatDueLabel(dueDate: string, now = new Date()): string {
  const days = daysUntil(dueDate, now)
  if (days === 0) return "Hoje"
  if (days === 1) return "Amanhã"
  if (days === 2) return "Em 2 dias"
  if (days === -1) return "Ontem"
  if (days < -1) return `Há ${Math.abs(days)} dias`
  return formatShortDate(dueDate)
}

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" })
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
const fullDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" })

/** "agora", "há 5 minutos", "há 3 horas", "ontem", "há 4 dias" ou "6 out, 14:30". */
export function formatRelative(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return "agora"
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute")
  if (abs < 6 * 3600 || date.toDateString() === now.toDateString()) return relative.format(Math.round(seconds / 3600), "hour")
  const days = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS)
  if (days >= -6) return relative.format(days, "day")
  return dateTime.format(date).replace(" de ", " ").replace(".", "")
}

export function formatFullDateTime(iso: string): string {
  return fullDateTime.format(new Date(iso))
}
