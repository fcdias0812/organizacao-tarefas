/**
 * Limita tentativas de login erradas por e-mail + IP, em memória.
 * Suficiente para um sistema interno de poucos usuários num único processo.
 */
const MAX_FAILURES = 8
const WINDOW_MS = 10 * 60 * 1000

interface Entry {
  failures: number
  resetAt: number
}

export function createLoginLimiter(now: () => number = Date.now) {
  const entries = new Map<string, Entry>()
  const keyOf = (ip: string, email: string) => `${ip}|${email.toLowerCase()}`

  return {
    /** Minutos até liberar, ou 0 se pode tentar. */
    blockedFor(ip: string, email: string): number {
      const entry = entries.get(keyOf(ip, email))
      if (!entry) return 0
      if (entry.resetAt <= now()) {
        entries.delete(keyOf(ip, email))
        return 0
      }
      return entry.failures >= MAX_FAILURES ? Math.ceil((entry.resetAt - now()) / 60_000) : 0
    },
    fail(ip: string, email: string) {
      const key = keyOf(ip, email)
      const entry = entries.get(key)
      if (!entry || entry.resetAt <= now()) entries.set(key, { failures: 1, resetAt: now() + WINDOW_MS })
      else entry.failures += 1
    },
    succeed(ip: string, email: string) {
      entries.delete(keyOf(ip, email))
    },
  }
}

export type LoginLimiter = ReturnType<typeof createLoginLimiter>
