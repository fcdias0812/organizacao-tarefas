import type { AddressInfo } from "node:net"
import type { UserRole } from "@tarefas/shared"

import { createApp } from "../app"
import { hashPassword } from "../auth/sessions"
import { openDatabase } from "../db/connection"
import { insertUser } from "../services/users"

export const TEST_PASSWORD = "senha-de-teste"

export interface ApiResponse<T = any> {
  status: number
  body: T
}

export interface ApiClient {
  userId: number
  request<T = any>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>>
}

/** Sobe a API com banco em memória: dois gestores e dois executores. */
export async function startTestServer() {
  const db = openDatabase(":memory:")
  const passwordHash = await hashPassword(TEST_PASSWORD)
  const users: Record<string, { id: number; email: string; role: UserRole }> = {}
  for (const [key, role] of [
    ["gerente", "manager"],
    ["coordenador", "manager"],
    ["analista", "executor"],
    // Usado só pelo teste de bloqueio por tentativas erradas.
    ["bloqueado", "executor"],
  ] as const) {
    const email = `${key}@teste.local`
    users[key] = { id: insertUser(db, { name: key, email, passwordHash, role, avatarColor: "violet" }), email, role }
  }

  const server = createApp({ db }).listen(0)
  await new Promise<void>((resolve) => server.once("listening", resolve))
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`

  async function raw(method: string, path: string, body?: unknown, cookie?: string): Promise<ApiResponse & { setCookie: string[] }> {
    const res = await fetch(baseUrl + path, {
      method,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    return { status: res.status, body: text ? JSON.parse(text) : null, setCookie: res.headers.getSetCookie() }
  }

  async function login(key: keyof typeof users): Promise<ApiClient> {
    const res = await raw("POST", "/auth/login", { email: users[key].email, password: TEST_PASSWORD })
    if (res.status !== 200) throw new Error(`login falhou: ${res.status}`)
    const cookie = res.setCookie.map((c) => c.split(";")[0]).join("; ")
    return { userId: users[key].id, request: (method, path, body) => raw(method, path, body, cookie) }
  }

  return {
    db,
    baseUrl,
    users,
    raw,
    login,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          db.close()
          resolve()
        })
      }),
  }
}
