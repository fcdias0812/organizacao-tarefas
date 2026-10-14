/**
 * Gestão de usuários pela linha de comando (a v1 não tem tela de administração).
 *
 *   npm run usuarios -- listar
 *   npm run usuarios -- criar --nome "Ana Lima" --email ana@empresa.com.br --perfil admin --cargo "Gerente de TI"
 *   npm run usuarios -- senha --email ana@empresa.com.br        (gera uma senha nova)
 *   npm run usuarios -- desativar --email ana@empresa.com.br    (bloqueia o acesso e encerra as sessões)
 *   npm run usuarios -- ativar --email ana@empresa.com.br
 *
 * Perfis: admin (gestor que também acessa Configurações), gestor (cria, atribui e aprova)
 * ou executor (cria para si, executa e envia para revisão).
 *
 * Para definir a senha em vez de gerar uma, passe-a na variável de ambiente SENHA
 * (assim ela não fica gravada em nenhum arquivo do projeto).
 */
import { parseArgs } from "node:util"
import { AVATAR_COLORS, type UserRole } from "@tarefas/shared"

import { hashPassword } from "../auth/sessions"
import { config } from "../config"
import { openDatabase } from "../db/connection"
import { generatePassword, insertUser, type UserRow } from "../services/users"

const PROFILES: Record<string, { role: UserRole; isAdmin: boolean }> = {
  admin: { role: "manager", isAdmin: true },
  gestor: { role: "manager", isAdmin: false },
  executor: { role: "executor", isAdmin: false },
}
const profileLabel = (u: UserRow) => (u.is_admin ? "admin" : u.role === "manager" ? "gestor" : "executor")

/** Senha vinda de SENHA (ex.: definida pela própria pessoa) ou gerada. */
function chosenPassword(): { password: string; generated: boolean } {
  const fromEnv = process.env.SENHA
  if (fromEnv) {
    if (fromEnv.length < 8) fail("A senha em SENHA precisa de pelo menos 8 caracteres.")
    return { password: fromEnv, generated: false }
  }
  return { password: generatePassword(), generated: true }
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
        `${u.is_active ? "●" : "○"} ${u.name.padEnd(24)} ${u.email.padEnd(32)} ${profileLabel(u).padEnd(9)} ${u.job_title ?? ""}${u.is_active ? "" : "  (desativado)"}`
      )
    }
    break
  }

  case "criar": {
    const name = values.nome?.trim()
    const profile = PROFILES[values.perfil?.toLowerCase() ?? ""]
    if (!name || !email || !profile) {
      fail('Uso: npm run usuarios -- criar --nome "Nome Sobrenome" --email pessoa@empresa --perfil admin|gestor|executor [--cargo "Cargo"]')
    }
    if (findByEmail()) fail(`Já existe um usuário com o e-mail ${email}.`)

    const { n } = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }
    const { password, generated } = chosenPassword()
    insertUser(db, {
      name,
      email,
      ...profile,
      jobTitle: values.cargo?.trim(),
      passwordHash: await hashPassword(password),
      avatarColor: AVATAR_COLORS[n % AVATAR_COLORS.length],
    })
    console.log(`✔ ${name} cadastrado(a) como ${values.perfil?.toLowerCase()}.`)
    if (generated) {
      console.log(`  Senha temporária: ${password}`)
      console.log("  Entregue a senha pessoalmente; ela não fica salva em lugar nenhum.")
    } else {
      console.log("  Senha definida pela variável SENHA.")
    }
    break
  }

  case "senha": {
    const user = findByEmail() ?? fail(`Usuário ${email ?? "(sem e-mail)"} não encontrado.`)
    const { password, generated } = chosenPassword()
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hashPassword(password), user.id)
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id)
    console.log(generated ? `✔ Nova senha de ${user.name}: ${password}` : `✔ Senha de ${user.name} atualizada.`)
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
Exemplo: npm run usuarios -- criar --nome "Ana Lima" --email ana@empresa.com.br --perfil admin --cargo "Gerente de TI"`)
}

db.close()
