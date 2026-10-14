import type { ApiErrorBody } from "@tarefas/shared"

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/** Chamada à API. Erros do servidor viram ApiError com a mensagem em português. */
export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    })
  } catch {
    throw new ApiError(0, "network_error", "Sem conexão com o servidor. Verifique a rede e tente de novo.")
  }

  if (res.status === 204) return undefined as T

  const data = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.code ?? "unknown_error",
      data?.error?.message ?? "Algo deu errado. Tente de novo."
    )
  }
  return data as T
}

export const isUnauthenticated = (error: unknown) => error instanceof ApiError && error.status === 401
