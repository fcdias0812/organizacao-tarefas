/**
 * O sistema na Vercel: o app Express inteiro vira uma função, e as telas
 * (build do client em public/) são entregues pela CDN da Vercel.
 * Fora da Vercel continua valendo `npm start` (index.ts).
 */
import { createApp } from "./app"
import { config } from "./config"
import { openDatabase } from "./db/connection"

export async function createVercelApp() {
  if (config.dbPath) {
    // Sem TURSO_DATABASE_URL a função usaria um arquivo local, que a Vercel apaga.
    throw new Error("Defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN nas variáveis do projeto na Vercel.")
  }
  const db = await openDatabase(config.db)
  // A Vercel sempre usa HTTPS: o cookie da sessão só trafega criptografado.
  return createApp({ db, secureCookies: true })
}
