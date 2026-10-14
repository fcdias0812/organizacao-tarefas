import { useState } from "react"
import { Check, History, ListChecks } from "lucide-react"
import { cn } from "cn"

import { StatusIcon } from "@/components/task/StatusIcon"
import { TaskCard } from "@/components/task/TaskCard"
import { addDays, toDateOnly } from "@/lib/dates"
import { STATUS_META, type TaskCardData, type TaskStatus, type User } from "@/lib/domain"

const rafael: User = { id: 2, name: "Rafael Lima", role: "manager", avatarColor: "teal" }
const juliana: User = { id: 3, name: "Juliana Souza", role: "executor", avatarColor: "amber" }
const marcos: User = { id: 1, name: "Marcos Almeida", role: "manager", avatarColor: "violet" }

function buildColumns(today: Date): { status: TaskStatus; className?: string; cards: TaskCardData[] }[] {
  const due = (days: number) => toDateOnly(addDays(today, days))
  return [
    {
      status: "todo",
      cards: [
        { id: 1, title: "Cotação de 5 notebooks para o comercial", status: "todo", priority: "medium", category: "purchase", dueDate: due(9), assignee: marcos, checklistDone: 1, checklistTotal: 5 },
        { id: 2, title: "Trocar fonte do switch do 2º andar", status: "todo", priority: "high", category: "infra", dueDate: due(1), assignee: juliana, checklistDone: 0, checklistTotal: 4 },
        { id: 3, title: "Atualizar o inventário de ativos", status: "todo", priority: "low", category: "routine", dueDate: due(12), assignee: null, checklistDone: 0, checklistTotal: 3 },
      ],
    },
    {
      status: "in_progress",
      cards: [
        { id: 4, title: "Renovar certificado SSL do portal", status: "in_progress", priority: "urgent", category: "infra", dueDate: due(1), assignee: rafael, checklistDone: 3, checklistTotal: 4 },
        { id: 5, title: "Implantar MFA no Microsoft 365", status: "in_progress", priority: "high", category: "project", dueDate: due(10), assignee: rafael, checklistDone: 2, checklistTotal: 4 },
        { id: 6, title: "Padronizar imagem do Windows 11", status: "in_progress", priority: "medium", category: "project", dueDate: due(20), assignee: juliana, checklistDone: 1, checklistTotal: 4 },
      ],
    },
    {
      status: "review",
      // Terceira coluna só aparece quando há espaço de sobra.
      className: "hidden 2xl:flex",
      cards: [
        { id: 7, title: "Configurar a impressora nova da recepção", status: "review", priority: "medium", category: "ticket", dueDate: due(5), assignee: juliana, checklistDone: 4, checklistTotal: 4 },
        { id: 8, title: "Substituir o nobreak da sala de servidores", status: "review", priority: "high", category: "infra", dueDate: due(2), assignee: rafael, checklistDone: 4, checklistTotal: 4 },
      ],
    },
  ]
}

const FEATURES = [
  { icon: ListChecks, label: "Checklist de pronto por categoria" },
  { icon: Check, label: "Revisão do gestor antes de concluir" },
  { icon: History, label: "Histórico de cada card" },
]

/** Lado direito do login: uma prévia do quadro que cresce com a tela. */
export function LoginShowcase() {
  const [today] = useState(() => new Date())
  const columns = buildColumns(today)

  return (
    <aside
      aria-hidden
      className="relative m-3 hidden flex-col gap-10 overflow-hidden rounded-[28px] bg-brand-600 p-12 lg:flex 2xl:p-16"
    >
      <div className="pointer-events-none absolute -top-40 -right-24 size-[34rem] rounded-full bg-brand-500 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -left-24 size-[32rem] rounded-full bg-brand-700 blur-3xl" />

      <div className="relative max-w-xl space-y-3 2xl:max-w-2xl">
        <p className="text-sm font-medium text-brand-200">Tarefas TI</p>
        <p className="text-3xl leading-tight font-semibold tracking-tight text-white 2xl:text-[2.75rem]">
          Nada esquecido. Ninguém sem saber quem faz o quê.
        </p>
        <p className="max-w-lg text-[15px] leading-relaxed text-brand-100/85 2xl:text-base">
          Cada tarefa com dono, prazo e checklist de pronto, e o gestor confirmando antes de concluir.
        </p>
      </div>

      {/* Prévia do quadro, sumindo suavemente na parte de baixo */}
      <div className="relative min-h-0 flex-1 [mask-image:linear-gradient(to_bottom,black_62%,transparent)]">
        <div className="flex h-full -rotate-1 gap-4 2xl:gap-5">
          {columns.map((col) => (
            <div
              key={col.status}
              className={cn(
                "flex min-w-0 flex-1 flex-col gap-2.5 rounded-3xl bg-white/10 p-2.5 ring-1 ring-white/15 backdrop-blur-sm",
                col.className
              )}
            >
              <div className="flex h-9 items-center gap-2 px-2">
                <span className="grid size-5 place-items-center rounded-full bg-white">
                  <StatusIcon status={col.status} className="size-3.5" />
                </span>
                <span className="text-[13px] font-semibold text-white">{STATUS_META[col.status].label}</span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/90 tabular-nums">
                  {col.cards.length}
                </span>
              </div>
              {col.cards.map((card) => (
                <TaskCard key={card.id} task={card} now={today} tabIndex={-1} className="pointer-events-none shadow-lift" />
              ))}
            </div>
          ))}
        </div>
      </div>

      <ul className="relative flex flex-wrap gap-x-6 gap-y-2">
        {FEATURES.map(({ icon: Icon, label }) => (
          <li key={label} className="inline-flex items-center gap-2 text-[13px] font-medium text-brand-100">
            <span className="grid size-6 place-items-center rounded-full bg-white/15">
              <Icon className="size-3.5 text-white" />
            </span>
            {label}
          </li>
        ))}
      </ul>
    </aside>
  )
}
