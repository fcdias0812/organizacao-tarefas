import { createApp } from "./app"
import { config } from "./config"
import { openDatabase } from "./db/connection"

const db = openDatabase(config.dbPath)
// Limpa sessões vencidas a cada início.
db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString())
const app = createApp({ db, secureCookies: config.secureCookies, clientDist: config.clientDist })

const server = app.listen(config.port, () => {
  console.log(`API pronta em http://localhost:${config.port} (banco: ${config.dbPath})`)
})

const shutdown = () => {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
