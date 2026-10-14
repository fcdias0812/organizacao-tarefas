// Função da Vercel que atende todo /api/*. O vercel.json reescreve /api/<caminho> para
// /api?__path=<caminho>; se o endereço original não chegar aqui, ele é remontado a partir
// desse parâmetro antes de entrar no Express. A API vem empacotada em dist-vercel/ por
// `npm run build:vercel`; a lógica fica em server/src/vercel.ts.
import type { IncomingMessage, ServerResponse } from "node:http"

import { createVercelApp } from "../dist-vercel/vercel.mjs"

const app = await createVercelApp()

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost")
  const path = url.searchParams.get("__path")
  if (path !== null) {
    url.searchParams.delete("__path")
    // A Vercel também repete o parâmetro nomeado da regra como ?path=.
    if (url.searchParams.get("path") === path) url.searchParams.delete("path")
    if (!url.pathname.startsWith("/api/")) req.url = `/api/${path}${url.search}`
    else req.url = `${url.pathname}${url.search}`
  }
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res)
}
