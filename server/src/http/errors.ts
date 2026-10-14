import type { ErrorRequestHandler, RequestHandler } from "express"
import type { RuleResult, RuleViolationCode } from "@tarefas/shared"

/** Forma mínima de um schema zod (evita depender do pacote zod aqui). */
interface Schema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { issues: { message: string }[] } }
}

export class HttpError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const notFound = (message = "Não encontrado.") => new HttpError(404, "not_found", message)

const RULE_STATUS: Record<RuleViolationCode, number> = {
  forbidden: 403,
  invalid_transition: 409,
  checklist_incomplete: 409,
  reason_required: 422,
}

/** Converte uma violação de regra de negócio em erro HTTP. */
export function assertRule<T>(result: RuleResult<T>): asserts result is Extract<RuleResult<T>, { ok: true }> {
  if (!result.ok) throw new HttpError(RULE_STATUS[result.code], result.code, result.message)
}

/** Valida o corpo com um schema zod; responde 422 com a primeira mensagem. */
export function parseBody<T>(schema: Schema<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {})
  if (!parsed.success) {
    throw new HttpError(422, "validation_error", parsed.error.issues[0]?.message ?? "Dados inválidos.")
  }
  return parsed.data
}

export function parseId(value: unknown): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw notFound()
  return id
}

/**
 * Mutações só aceitam JSON. Junto com o cookie SameSite=Lax, isso impede que
 * outro site dispare ações em nome do usuário com um formulário comum.
 */
export const requireJson: RequestHandler = (req, _res, next) => {
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(req.method)
  const hasContentType = Boolean(req.headers["content-type"])
  if (isMutation && hasContentType && !req.is("application/json")) {
    return next(new HttpError(415, "unsupported_media_type", "Envie os dados como JSON."))
  }
  next()
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } })
    return
  }
  // JSON malformado vindo do express.json()
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "invalid_json", message: "JSON inválido." } })
    return
  }
  console.error(err)
  res.status(500).json({ error: { code: "internal_error", message: "Erro inesperado no servidor." } })
}
