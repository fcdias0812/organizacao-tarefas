import { createApp } from "./app"
import { config, dbLabel } from "./config"
import { openDatabase } from "./db/connection"

const db = await openDatabase(config.db)
// Limpa sessões vencidas a cada início.
await db.run("DELETE FROM sessions WHERE expires_at <= ?", new Date().toISOString())
const app = createApp({ db, secureCookies: config.secureCookies, clientDist: config.clientDist })

const server = app.listen(config.port, () => {
  console.log(`API pronta em http://localhost:${config.port} (banco: ${dbLabel})`)
})

const shutdown = () => {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
