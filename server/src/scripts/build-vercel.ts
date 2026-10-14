/**
 * Empacota a API num único arquivo para a Vercel (dist-vercel/vercel.mjs), chamado por
 * `npm run build:vercel` na raiz. A Vercel compila cada .ts separado e mantém os imports
 * sem extensão, que o Node não aceita em ESM; empacotado, isso deixa de existir.
 * O pacote compartilhado (TypeScript) e o zod vão para dentro do arquivo; as dependências
 * com partes nativas ou grandes ficam de fora e a Vercel as inclui de node_modules.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { build } from "esbuild"

import { ROOT_DIR } from "../config"

const outDir = join(ROOT_DIR, "dist-vercel")
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

await build({
  entryPoints: [join(ROOT_DIR, "server", "src", "vercel.ts")],
  outfile: join(outDir, "vercel.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  external: ["express", "cookie-parser", "bcryptjs", "@libsql/client"],
  logLevel: "warning",
})

// connection.ts procura as migrações em "migrations/" ao lado do próprio arquivo.
cpSync(join(ROOT_DIR, "server", "src", "db", "migrations"), join(outDir, "migrations"), { recursive: true })

// Tipos mínimos para o server.ts da raiz importar o arquivo gerado.
writeFileSync(
  join(outDir, "vercel.d.mts"),
  'import type { Express } from "express"\nexport declare function createVercelApp(): Promise<Express>\n'
)

console.log("✔ API empacotada em dist-vercel/")
