import { DEFAULT_SETTINGS } from "./settings"
import type { TaskEventType, TaskStatus, UserRole } from "./types"

/**
 * Regras de qualidade do quadro. Usadas pelo servidor (que decide) e pela
 * interface (que antecipa o resultado para dar feedback durante o arraste).
 * As mensagens são exibidas ao usuário, por isso estão em português, e usam
 * os nomes de colunas configurados pelo administrador.
 */

export interface RuleOptions {
  statusLabels: Record<TaskStatus, string>
  reasonMinLength: number
}

const DEFAULT_OPTIONS: RuleOptions = {
  statusLabels: DEFAULT_SETTINGS.statusLabels,
  reasonMinLength: DEFAULT_SETTINGS.reasonMinLength,
}

export interface Actor {
  id: number
  role: UserRole
}

export type RuleViolationCode =
  | "forbidden"
  | "invalid_transition"
  | "checklist_incomplete"
  | "reason_required"

export type RuleResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; code: RuleViolationCode; message: string }

export interface MoveInput {
  from: TaskStatus
  to: TaskStatus
  actorRole: UserRole
  checklistDone: number
  checklistTotal: number
  reason?: string | null
}

export const REASON_MAX_LENGTH = 500

/** Statuses em que o checklist pode ser alterado. */
export const CHECKLIST_EDITABLE_STATUSES: readonly TaskStatus[] = ["todo", "in_progress", "blocked"]

const deny = (code: RuleViolationCode, message: string) => ({ ok: false as const, code, message })

export function hasValidReason(reason: string | null | undefined, minLength = DEFAULT_OPTIONS.reasonMinLength): boolean {
  return (reason?.trim().length ?? 0) >= Math.max(1, minLength)
}

export function isChecklistComplete(done: number, total: number): boolean {
  return total > 0 && done === total
}

/**
 * Valida uma movimentação entre colunas e informa qual evento registrar.
 * `event: null` significa reordenação dentro da mesma coluna (sem histórico).
 */
export function checkMove(
  input: MoveInput,
  options: RuleOptions = DEFAULT_OPTIONS
): RuleResult<{ event: TaskEventType | null }> {
  const { from, to, actorRole, checklistDone, checklistTotal, reason } = input
  const isManager = actorRole === "manager"
  const L = options.statusLabels
  const validReason = hasValidReason(reason, options.reasonMinLength)

  if (from === to) return { ok: true, event: null }

  // Saindo da Revisão: só o gestor, para aprovar ou devolver.
  if (from === "review") {
    if (!isManager) return deny("forbidden", `Só o gestor tira um card de ${L.review}.`)
    if (to === "done") return { ok: true, event: "approved" }
    if (to === "in_progress") {
      if (!validReason) return deny("reason_required", "Informe o motivo da devolução.")
      return { ok: true, event: "returned" }
    }
    return deny("invalid_transition", `Em ${L.review} o gestor aprova ou devolve o card.`)
  }

  // Saindo de Concluído: reabrir é só com o gestor.
  if (from === "done") {
    if (!isManager) return deny("forbidden", "Só o gestor reabre um card concluído.")
    if (to === "todo" || to === "in_progress") return { ok: true, event: "reopened" }
    return deny("invalid_transition", `Para reabrir, mova o card para ${L.todo} ou ${L.in_progress}.`)
  }

  // Saindo de Bloqueado: volta para o fluxo normal.
  if (from === "blocked") {
    if (to === "todo" || to === "in_progress") return { ok: true, event: "unblocked" }
    return deny("invalid_transition", `Desbloqueie o card movendo para ${L.todo} ou ${L.in_progress}.`)
  }

  // A partir daqui: from é "todo" ou "in_progress".
  switch (to) {
    case "todo":
    case "in_progress":
      return { ok: true, event: "moved" }
    case "blocked":
      if (!validReason) return deny("reason_required", "Informe o motivo do bloqueio.")
      return { ok: true, event: "blocked" }
    case "review": {
      if (checklistTotal === 0) {
        return deny("checklist_incomplete", `Adicione ao menos um item no checklist antes de enviar para ${L.review}.`)
      }
      const missing = checklistTotal - checklistDone
      if (missing > 0) {
        return deny(
          "checklist_incomplete",
          missing === 1
            ? `Falta 1 item do checklist para enviar para ${L.review}.`
            : `Faltam ${missing} itens do checklist para enviar para ${L.review}.`
        )
      }
      return { ok: true, event: "sent_to_review" }
    }
    case "done":
      return deny("invalid_transition", `Antes de concluir, o card passa por ${L.review} com o gestor.`)
  }
}

/** Eventos que só acontecem com um motivo escrito (abrem o modal de motivo). */
export const EVENTS_REQUIRING_REASON: readonly TaskEventType[] = ["blocked", "returned"]

/**
 * Antecipa se um card pode ir para a coluna, antes de existir um motivo.
 * Usado pela interface durante o arraste: `needsReason` indica que, ao soltar,
 * é preciso pedir o motivo (bloquear ou devolver).
 */
export function previewMove(
  input: Omit<MoveInput, "reason">,
  options: RuleOptions = DEFAULT_OPTIONS
): RuleResult<{ event: TaskEventType | null; needsReason: boolean }> {
  const result = checkMove({ ...input, reason: "x".repeat(Math.max(1, options.reasonMinLength)) }, options)
  if (!result.ok) return result
  return { ok: true, event: result.event, needsReason: result.event !== null && EVENTS_REQUIRING_REASON.includes(result.event) }
}

export const POSITION_STEP = 1024

/**
 * Posição fracionária para inserir um card no índice `index` de uma coluna
 * (posições já ordenadas, sem o próprio card). Retorna null quando não há
 * mais espaço entre os vizinhos e a coluna precisa ser renumerada.
 */
export function positionBetween(sortedPositions: readonly number[], index?: number): number | null {
  const i = index === undefined ? sortedPositions.length : Math.min(Math.max(index, 0), sortedPositions.length)
  const prev = sortedPositions[i - 1]
  const next = sortedPositions[i]
  if (prev === undefined && next === undefined) return POSITION_STEP
  if (prev === undefined) return next - POSITION_STEP
  if (next === undefined) return prev + POSITION_STEP
  return next - prev > 1e-6 ? (prev + next) / 2 : null
}

/** Gestor atribui para qualquer pessoa; executor só para si mesmo. */
export function checkAssign(actor: Actor, assigneeId: number | null): RuleResult {
  if (actor.role === "manager") return { ok: true }
  if (assigneeId === actor.id) return { ok: true }
  return deny("forbidden", "Só o gestor atribui tarefas para outras pessoas.")
}

export function checkChecklistEditable(status: TaskStatus, options: RuleOptions = DEFAULT_OPTIONS): RuleResult {
  if (CHECKLIST_EDITABLE_STATUSES.includes(status)) return { ok: true }
  return deny(
    "invalid_transition",
    status === "review"
      ? `O checklist fica travado enquanto o card está em ${options.statusLabels.review}.`
      : "O checklist fica travado em cards concluídos."
  )
}

/** Itens do padrão da categoria só podem ser removidos pelo gestor. */
export function checkChecklistItemRemoval(actorRole: UserRole, isFromTemplate: boolean): RuleResult {
  if (!isFromTemplate || actorRole === "manager") return { ok: true }
  return deny("forbidden", "Itens do checklist padrão da categoria só podem ser removidos pelo gestor.")
}
