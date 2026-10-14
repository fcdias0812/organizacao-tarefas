// Ponto de entrada que a Vercel procura na raiz do projeto (ela exige que o arquivo importe o express).
// A API vem empacotada em dist-vercel/ por `npm run build:vercel`; a lógica fica em server/src/vercel.ts.
import express from "express"

import { createVercelApp } from "./dist-vercel/vercel.mjs"

const app = express()
app.use(await createVercelApp())

export default app
