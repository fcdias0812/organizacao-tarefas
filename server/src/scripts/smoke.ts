/**
 * Verificação rápida da API rodando: faz login com um usuário de exemplo e
 * imprime o quadro por coluna.  Uso: npm run smoke  (com a API no ar)
 */
import type { TaskSummaryDTO, UserDTO } from "@tarefas/shared"

import { DEV_SEED_PASSWORD, SEED_USERS } from "../db/seed-data"
import { STATUS_LABELS } from "./labels"

const base = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3333}/api`

const login = await fetch(`${base}/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: SEED_USERS.rafael.email, password: DEV_SEED_PASSWORD }),
}).catch(() => null)

if (!login) {
  console.error(`Não consegui falar com a API em ${base}. Ela está rodando? (npm run dev)`)
  process.exit(1)
}
if (login.status !== 200) {
  console.error(`Login falhou (${login.status}). Rode "npm run seed" para criar os usuários de exemplo.`)
  process.exit(1)
}

const { user } = (await login.json()) as { user: UserDTO }
const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ")
const { tasks } = (await (await fetch(`${base}/tasks`, { headers: { cookie } })).json()) as { tasks: TaskSummaryDTO[] }

console.log(`\n✔ Login OK como ${user.name} (${user.jobTitle})\n`)
for (const [status, label] of Object.entries(STATUS_LABELS)) {
  const column = tasks.filter((t) => t.status === status)
  console.log(`${label} (${column.length})`)
  for (const t of column) {
    const extra = t.blockedReason ? `  ⛔ ${t.blockedReason}` : t.lastReturnReason ? `  ↩ ${t.lastReturnReason}` : ""
    console.log(`  • ${t.title}  [${t.checklistDone}/${t.checklistTotal}]${extra}`)
  }
  console.log()
}
