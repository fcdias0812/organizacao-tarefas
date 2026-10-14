import { addDays, toDateOnly } from "@/lib/dates"
import type { TaskCardData, User } from "@/lib/domain"

// Dados fictícios só para a vitrine do design system.

export const users = {
  marcos: { id: 1, name: "Marcos Almeida", role: "manager", avatarColor: "violet" },
  rafael: { id: 2, name: "Rafael Lima", role: "executor", avatarColor: "teal" },
  juliana: { id: 3, name: "Juliana Souza", role: "executor", avatarColor: "amber" },
} satisfies Record<string, User>

const inDays = (days: number) => toDateOnly(addDays(new Date(), days))

export const sampleTasks = {
  overdue: {
    id: 101,
    title: "Renovar certificado SSL do portal de clientes",
    status: "in_progress",
    priority: "urgent",
    category: "infra",
    dueDate: inDays(-1),
    assignee: users.rafael,
    checklistDone: 1,
    checklistTotal: 4,
  },
  soon: {
    id: 102,
    title: "Trocar fonte redundante do switch do rack do 2º andar",
    status: "todo",
    priority: "high",
    category: "infra",
    dueDate: inDays(1),
    assignee: users.juliana,
    checklistDone: 0,
    checklistTotal: 4,
  },
  normal: {
    id: 103,
    title: "Cotação de 5 notebooks para a equipe comercial",
    status: "todo",
    priority: "medium",
    category: "purchase",
    dueDate: inDays(9),
    assignee: users.marcos,
    checklistDone: 1,
    checklistTotal: 5,
  },
  review: {
    id: 104,
    title: "Impressora do RH não imprime frente e verso",
    status: "review",
    priority: "low",
    category: "ticket",
    dueDate: inDays(2),
    assignee: users.juliana,
    checklistDone: 4,
    checklistTotal: 4,
  },
  blocked: {
    id: 105,
    title: "Liberar VPN site-to-site para o novo escritório",
    status: "blocked",
    priority: "high",
    category: "infra",
    dueDate: inDays(5),
    assignee: users.rafael,
    checklistDone: 2,
    checklistTotal: 4,
    blockedReason: "Aguardando a operadora liberar o IP fixo (protocolo 88213).",
  },
  returned: {
    id: 106,
    title: "Migrar caixas de e-mail do financeiro para o novo tenant",
    status: "in_progress",
    priority: "high",
    category: "project",
    dueDate: inDays(4),
    assignee: users.juliana,
    checklistDone: 4,
    checklistTotal: 4,
    lastReturnReason: "Faltou validar o acesso pelo celular da diretoria.",
  },
  done: {
    id: 107,
    title: "Backup semanal do servidor de arquivos",
    status: "done",
    priority: "medium",
    category: "routine",
    dueDate: inDays(-2),
    assignee: users.rafael,
    checklistDone: 3,
    checklistTotal: 3,
  },
  unassigned: {
    id: 108,
    title: "Atualizar inventário de ativos de TI no planilhão",
    status: "todo",
    priority: "low",
    category: "routine",
    dueDate: inDays(12),
    assignee: null,
    checklistDone: 0,
    checklistTotal: 3,
  },
} satisfies Record<string, TaskCardData>

// Checklist padrão de "Projeto". Após uma devolução os itens continuam marcados
// (decisão da fase de planejamento); o motivo fica registrado no histórico.
export const sampleChecklist = [
  { id: 1, label: "Escopo validado com o solicitante", done: true },
  { id: 2, label: "Testes realizados", done: true },
  { id: 3, label: "Documentação entregue", done: true },
  { id: 4, label: "Solicitante aprovou a entrega", done: true },
]

export const sampleHistory = [
  { id: 1, who: users.marcos, text: "criou a tarefa e atribuiu a Juliana Souza", when: "seg, 09:12" },
  { id: 2, who: users.juliana, text: "moveu de A fazer para Em andamento", when: "seg, 10:40" },
  { id: 3, who: users.juliana, text: "enviou para Revisão", when: "ter, 15:02" },
  {
    id: 4,
    who: users.marcos,
    text: "devolveu para Em andamento",
    reason: "Faltou validar o acesso pelo celular da diretoria.",
    when: "ter, 16:30",
  },
]
