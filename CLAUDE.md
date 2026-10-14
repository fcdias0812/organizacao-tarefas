# Tarefas TI — guia para o Claude

Sistema interno de tarefas do setor de TI (3 usuários). Monorepo npm workspaces: `shared/`, `server/`, `client/`.
Visão geral, comandos e regras de negócio: ver `README.md`.

## Convenções

- **Código em inglês; interface, mensagens de erro e conversa com o usuário em português do Brasil.**
- Regras de negócio ficam **só** em `shared/src/rules.ts` e valem nos dois lados: o servidor decide
  (`server/src/services/tasks.ts`), a interface antecipa (`previewMove`, `checkAssign`…). Mudou regra → teste em `shared/src/rules.test.ts`.
- Validação de entrada: schemas zod em `shared/src/schemas.ts`. O `server` não depende de zod diretamente
  (a raiz tem zod 3 vindo do CLI do shadcn; o `shared` tem zod 4 próprio).
- Banco: SQL puro (SQLite) via `@libsql/client` — arquivo local em desenvolvimento/testes, Turso em produção
  (`TURSO_DATABASE_URL`). Todo acesso é assíncrono pela interface `Db` de `server/src/db/connection.ts`
  (`all`/`get`/`run`/`exec`). Mudança de esquema = novo arquivo em `server/src/db/migrations/NNN_nome.sql`
  (nunca editar migração já aplicada). Escritas que mexem em mais de uma tabela vão dentro de
  `db.transaction(async (tx) => …)`, usando **só o `tx`** lá dentro.
- Chaves estrangeiras ficam desligadas no Turso: nunca dependa de `ON DELETE CASCADE`, apague os filhos explicitamente.
- Vercel: `server.ts` (raiz) → `dist-vercel/vercel.mjs`, gerado por `npm run build:vercel` (esbuild) a partir de
  `server/src/vercel.ts`. Não troque isso por import direto dos `.ts`: a Vercel compila arquivo a arquivo e o
  Node recusa os imports sem extensão. Depois de mexer nisso, rode `npx vercel build` e teste a função gerada.
- Datas de prazo são `AAAA-MM-DD` em horário **local** — nunca usar `toISOString()` para elas.
- **Nada de nomes fixos na interface**: colunas, prioridades (nome e cor), categorias, nome do sistema, cor
  principal, prazo "vence em breve" e motivo mínimo vêm de Configurações. No cliente use `useAppConfig()`
  (`features/settings/appConfig.ts`); no servidor, `getSettings()`/`ruleOptions()`. Padrões em `shared/src/settings.ts`.
- Categorias são dinâmicas (tabela `categories`, chave = slug imutável). Categoria com tarefas só é desativada, nunca excluída.
- Administrador = gestor com `is_admin`. Rotas `/api/admin/*` usam `requireAdmin`. Sempre deve existir 1 admin ativo.
- Histórico (`task_events`) só recebe inserções.

## Design

- Tokens em `client/src/index.css`. A cor principal é `--brand-600` (padrão violeta #7C3AED, configurável);
  os outros tons (`brand-50`…`brand-900`) são derivados dela com `color-mix`. Nunca escreva o hex da cor
  principal no código. Ela aparece só em ação principal, destaque e estado ativo.
- Cor nos botões indica o resultado: violeta neutro, verde conclui, âmbar devolve, vermelho bloqueia/exclui, cinza indisponível.
- Cantos arredondados (cards `rounded-xl`, painéis `rounded-3xl`, botões pill), sombras difusas, quase sem bordas.
- `client/src/components/ui/` são componentes shadcn **remodelados**. Nunca rode `shadcn add` com `-o`:
  ele já sobrescreveu `button.tsx` uma vez. Depois de qualquer `shadcn add`, confira o diff de `components/ui`.

## Verificação antes de entregar

```bash
npm test && npm run typecheck && npm run lint && npm run build
```

Os dois avisos `only-export-components` em `button.tsx` e `badge.tsx` são esperados (padrão do shadcn).
