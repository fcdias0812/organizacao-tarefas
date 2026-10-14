# Tarefas TI

Sistema interno de gestão de tarefas do setor de TI: quadro Kanban com controle de qualidade
(checklist de "pronto" por categoria, revisão do gestor e histórico de cada card).

## Requisitos

- Node.js 24 ou mais novo

## Começando (desenvolvimento)

```bash
npm install
npm run seed      # cria o banco com 3 usuários e 25 tarefas de exemplo
npm run dev       # API em :3333 e telas em :5173 (com recarga automática)
```

- Telas: http://localhost:5173 · vitrine do design system em `/design-system`
- Usuários de exemplo: `marcos@tarefas.local` e `rafael@tarefas.local` (Gestores),
  `juliana@tarefas.local` (Executora). A senha está em `server/.env.example` (`SEED_PASSWORD`).
- `npm run db:reset` apaga as tarefas e os usuários de exemplo, mas **preserva as contas reais**
  (como a do administrador).

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | API e telas em modo desenvolvimento |
| `npm run build` | Gera as telas otimizadas em `client/dist` |
| `npm start` | Sobe o sistema completo (API + telas) num único processo, porta 3333 |
| `npm test` | Testes das regras de negócio, da criação rápida e da API |
| `npm run typecheck` | Confere os tipos de todo o projeto |
| `npm run usuarios -- …` | Cadastra, lista, troca senha, desativa e reativa usuários (veja abaixo) |
| `npm run backup` | Cópia de segurança do banco em `backups/` (pode rodar com o sistema no ar) |
| `npm run smoke` | Com a API no ar, faz login de exemplo e imprime o quadro no terminal |
| `npm run seed` | Cria os dados de exemplo (só se o banco estiver vazio) |
| `npm run db:reset` | **Apaga as tarefas** e recria os dados de exemplo (contas reais são mantidas) — só para desenvolvimento |

## Colocando em produção

1. Na máquina que vai hospedar o sistema, com Node.js 24+:
   ```bash
   npm ci
   npm run build
   ```
2. (Opcional) Copie `server/.env.example` para `server/.env` e ajuste a porta.
   Se o acesso for por HTTPS, use `COOKIE_SECURE=true`.
3. **Não rode o seed.** O banco é criado vazio na primeira execução. Crie o primeiro administrador:
   ```bash
   npm run usuarios -- criar --nome "Nome Sobrenome" --email pessoa@empresa.com.br --perfil admin --cargo "Gerente de TI"
   ```
   O comando mostra uma **senha temporária** uma única vez. Depois disso, o administrador cadastra
   as demais pessoas pela tela, em **Configurações → Usuários**.
4. Suba o sistema e acesse `http://<nome-ou-ip-da-máquina>:3333`:
   ```bash
   npm start
   ```
5. Para manter o sistema no ar depois de reiniciar a máquina, registre o `npm start` no gerenciador
   de processos/serviços que a equipe já usa para os outros sistemas internos.

### Usuários

O dia a dia é pela tela, em **Configurações → Usuários** (só administrador). A linha de comando
serve para o primeiro acesso e para emergências (ex.: o administrador esqueceu a senha):

```bash
npm run usuarios -- listar
npm run usuarios -- criar --nome "Ana Lima" --email ana@empresa.com.br --perfil admin --cargo "Gerente de TI"
npm run usuarios -- senha --email ana@empresa.com.br        # gera senha nova e encerra as sessões dela
npm run usuarios -- desativar --email ana@empresa.com.br    # bloqueia o acesso (o histórico continua)
npm run usuarios -- ativar --email ana@empresa.com.br
```

Para definir a senha em vez de gerar, passe-a na variável de ambiente `SENHA` só para aquele comando
(ela não fica gravada em nenhum arquivo).

Perfis: **executor** cria tarefas para si, executa e envia para revisão; **gestor** também atribui
para qualquer pessoa e aprova ou devolve na revisão; **administrador** é um gestor que também acessa
Configurações. Cada pessoa troca a própria senha em "Alterar senha", no menu do usuário.

### Backup

O banco é um arquivo só: `data/tarefas.db`. `npm run backup` gera uma cópia consistente mesmo com o
sistema rodando (padrão: pasta `backups/`; ou `npm run backup -- D:\copias`). Agende esse comando
no Agendador de Tarefas do Windows e guarde as cópias fora da máquina.

## Configurações (administrador)

Menu do usuário → **Configurações**:

| Aba | O que personaliza |
|---|---|
| Usuários | Cadastrar, editar, perfil (executor, gestor, administrador), cargo, cor do avatar, gerar nova senha, desativar |
| Categorias | Criar, renomear, ícone, ordem, **checklist padrão de pronto** (pode ficar vazio), desativar ou excluir |
| Colunas | Nomes das 5 colunas (as regras continuam as mesmas) |
| Prioridades | Nome e cor de cada nível |
| Prazos e regras | Quantos dias antes o prazo fica âmbar; tamanho mínimo do motivo de bloqueio/devolução |
| Identidade | Nome do sistema e cor principal (os tons claros e escuros são calculados dela) |
| Design system | Guia visual com todos os componentes |

Mudanças no checklist padrão valem para tarefas novas; as existentes mantêm o checklist que têm.
Categoria com tarefas não pode ser excluída, só desativada (some das opções, mas o histórico fica).

## Como usar

- **N** abre a criação rápida. Atalhos na mesma linha: `#infra` `!alta` `@juliana` e prazos como
  `hoje`, `amanhã`, `sexta` ou `20/10`. **Enter cria e já abre a tarefa no painel**; Shift+Enter cria
  e deixa o campo aberto para lançar a próxima.
- **/** vai para a busca. Filtros por responsável, categoria e prioridade ficam na URL (dá para mandar o link).
- **Arrastar e soltar** entre colunas. A coluna que aceita acende; a que recusa apaga e explica o motivo.
  Pelo teclado: foque um card, Espaço pega, setas movem, Espaço solta, Esc cancela.
- **Clique (ou Enter) num card** abre o painel lateral: editar, checklist, ações e a **Atividade**
  (movimentações e comentários de acompanhamento na mesma linha do tempo). A tarefa aberta fica na
  URL (`/?tarefa=12`). Comentários: qualquer pessoa escreve; só o autor edita; o autor ou um
  administrador exclui.

## Regras de qualidade

- Ao criar a tarefa, o checklist padrão da categoria é copiado para o card.
- Só vai para **Revisão** com o checklist 100% marcado.
- Só **Gestor** tira um card da Revisão: aprova (→ Concluído) ou devolve (→ Em andamento, motivo obrigatório).
- Devolver mantém o checklist marcado; o motivo fica no card até ele voltar para a Revisão.
- **Bloqueado** exige motivo. Reabrir um card concluído é só com o Gestor.
- O checklist fica travado em Revisão e Concluído.
- Executor só atribui tarefas a si mesmo e não remove itens do checklist padrão.

## Estrutura

```
shared/   Tipos, validações (zod), regras de negócio e leitura da criação rápida
          — usados pela API e pelas telas, com testes próprios
server/   API (Express 5 + SQLite nativo do Node, rodando com tsx)
  src/db/migrations/          esquema do banco + categorias e checklists padrão
  src/services/tasks.ts       criação, edição, movimentação e histórico
  src/scripts/                usuarios, backup, smoke
  src/tests/                  testes de integração da API
client/   Telas (React + Vite + TypeScript + Tailwind 4 + shadcn/ui + dnd-kit + TanStack Query)
  src/index.css               tokens de design (cores, raios, sombras, animações)
  src/components/             componentes base (ui/) e de domínio (task/, board/)
  src/features/               auth, board (quadro, arraste, filtros) e task (painel, criação rápida)
data/     banco SQLite (fora do git)
```

## API

Todas as rotas ficam em `/api` e, exceto o login, exigem sessão (cookie `sid`, httpOnly, SameSite=Lax).
Chamadas prontas para testar à mão: `server/requests.http` (extensão REST Client do VS Code).

| Método | Rota | |
|---|---|---|
| POST | `/auth/login` · `/auth/logout` | Entrar / sair (8 tentativas erradas bloqueiam por até 10 min) |
| GET | `/auth/me` | Usuário logado |
| GET | `/settings` | Configurações gerais (pública: o login usa nome e cor) |
| POST | `/auth/password` | Trocar a própria senha |
| GET | `/users` · `/categories` | Pessoas e categorias (com checklist padrão) |
| GET · POST | `/tasks` | Quadro / criar tarefa |
| GET · PATCH | `/tasks/:id` | Detalhe (checklist + histórico) / editar |
| POST | `/tasks/:id/move` | Mudar de coluna ou posição (`status`, `index`, `reason`) |
| POST | `/tasks/:id/checklist` | Adicionar item |
| PATCH · DELETE | `/tasks/:id/checklist/:itemId` | Marcar, renomear ou remover item |
| POST · PATCH · DELETE | `/tasks/:id/comments[/:commentId]` | Comentários de acompanhamento |
| vários | `/admin/users` · `/admin/categories` · `/admin/settings` | Configurações (só administrador) |

## Fora da v1 (ideias para a v2)

Tarefas recorrentes, painel de métricas, notificações, alerta de card parado e exclusão de tarefas.
