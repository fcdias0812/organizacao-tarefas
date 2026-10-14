/**
 * Gestão de usuários pela linha de comando (a v1 não tem tela de administração).
 *
 *   npm run usuarios -- listar
 *   npm run usuarios -- criar --nome "Ana Lima" --email ana@empresa.com.br --perfil gestor --cargo "Gerente de TI"
 *   npm run usuarios -- senha --email ana@empresa.com.br        (gera uma senha nova)
 *   npm run usuarios -- desativar --email ana@empresa.com.br    (bloqueia o acesso e encerra as sessões)
 *   npm run usuarios -- ativar --email ana@empresa.com.br
 *
 * Perfis: gestor (cria, atribui e aprova) ou executor (cria para si, executa e envia para revisão).
 */
import { randomInt } from "node:crypto"
import { parseArgs } from "node:util"
import { AVATAR_COLORS, type UserRole } from "@tarefas/shared"

import { hashPassword } from "../auth/sessions"
import { config } from "../config"
import { openDatabase } from "../db/connection"
import { insertUser, type UserRow } from "../services/users"

const ROLES: Record<string, UserRole> = { gestor: "manager", executor: "executor" }
const ROLE_LABEL: Record<UserRole, string> = { manager: "gestor", executor: "executor" }

/** Senha temporária legível (sem caracteres que se confundem, como 0/O e 1/l). */
function generatePassword(length = 12) {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("")
}

function fail(message: string): never {
  console.error(`✖ ${message}`)
  process.exit(1)
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    nome: { type: "string" },
    email: { type: "string" },
    perfil: { type: "string" },
    cargo: { type: "string" },
  },
})

const command = positionals[0]
const db = openDatabase(config.dbPath)
const email = values.email?.trim().toLowerCase()
const findByEmail = () =>
  db.prepare("SELECT * FROM users WHERE email = ?").get(email ?? "") as UserRow | undefined

switch (command) {
  case "listar": {
    const users = db.prepare("SELECT * FROM users ORDER BY is_active DESC, name").all() as unknown as UserRow[]
    if (users.length === 0) console.log("Nenhum usuário cadastrado.")
    for (const u of users) {
      console.log(
        `${u.is_active ? "●" : "○"} ${u.name.padEnd(24)} ${u.email.padEnd(32)} ${ROLE_LABEL[u.role].padEnd(9)} ${u.job_title ?? ""}${u.is_active ? "" : "  (desativado)"}`
      )
    }
    break
  }

  case "criar": {
    const name = values.nome?.trim()
    const role = ROLES[values.perfil?.toLowerCase() ?? ""]
    if (!name || !email || !role) {
      fail('Uso: npm run usuarios -- criar --nome "Nome Sobrenome" --email pessoa@empresa --perfil gestor|executor [--cargo "Cargo"]')
    }
    if (findByEmail()) fail(`Já existe um usuário com o e-mail ${email}.`)

    const { n } = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }
    const password = generatePassword()
    insertUser(db, {
      name,
      email,
      role,
      jobTitle: values.cargo?.trim(),
      passwordHash: await hashPassword(password),
      avatarColor: AVATAR_COLORS[n % AVATAR_COLORS.length],
    })
    console.log(`✔ ${name} cadastrado(a) como ${ROLE_LABEL[role]}.`)
    console.log(`  Senha temporária: ${password}`)
    console.log("  Entregue a senha pessoalmente; ela não fica salva em lugar nenhum.")
    break
  }

  case "senha": {
    const user = findByEmail() ?? fail(`Usuário ${email ?? "(sem e-mail)"} não encontrado.`)
    const password = generatePassword()
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hashPassword(password), user.id)
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id)
    console.log(`✔ Nova senha de ${user.name}: ${password}`)
    console.log("  As sessões abertas dessa pessoa foram encerradas.")
    break
  }

  case "desativar":
  case "ativar": {
    const user = findByEmail() ?? fail(`Usuário ${email ?? "(sem e-mail)"} não encontrado.`)
    const active = command === "ativar"
    db.prepare("UPDATE users SET is_active = ? WHERE id = ?").run(active ? 1 : 0, user.id)
    if (!active) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id)
    console.log(`✔ ${user.name} ${active ? "reativado(a)" : "desativado(a)"}.`)
    break
  }

  default:
    console.log(`Comandos: listar | criar | senha | desativar | ativar
Exemplo: npm run usuarios -- criar --nome "Ana Lima" --email ana@empresa.com.br --perfil gestor --cargo "Gerente de TI"`)
}

db.close()
