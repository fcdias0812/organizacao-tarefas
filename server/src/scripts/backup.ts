/**
 * Cópia de segurança do banco, segura mesmo com o sistema rodando.
 *   npm run backup                 → backups/tarefas-AAAA-MM-DD_HHMM.db
 *   npm run backup -- D:\copias    → na pasta indicada
 */
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { backup, DatabaseSync } from "node:sqlite"

import { config, ROOT_DIR } from "../config"

const folder = resolve(process.argv[2] ?? join(ROOT_DIR, "backups"))
mkdirSync(folder, { recursive: true })

// Data e hora locais (não UTC) no nome do arquivo.
const now = new Date()
const pad = (n: number) => String(n).padStart(2, "0")
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
const target = join(folder, `tarefas-${stamp}.db`)

const source = new DatabaseSync(config.dbPath, { readOnly: true })
const pages = await backup(source, target)
source.close()

console.log(`✔ Backup criado: ${target} (${pages} páginas)`)
