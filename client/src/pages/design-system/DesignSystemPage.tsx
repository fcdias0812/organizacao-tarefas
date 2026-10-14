import { useState } from "react"
import {
  Ban,
  Check,
  ChevronDown,
  CornerDownLeft,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { BoardColumn } from "@/components/board/BoardColumn"
import { EmptyColumn } from "@/components/empty-states/EmptyColumn"
import { StatusIcon } from "@/components/task/StatusIcon"
import { TaskCard, TaskCardPlaceholder } from "@/components/task/TaskCard"
import { CategoryChip, CategoryLabel, DueChip, PriorityDot, UserAvatar } from "@/components/task/TaskMeta"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetTrigger } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { addDays, toDateOnly } from "@/lib/dates"
import { useAppConfig } from "@/features/settings/appConfig"
import { PRIORITY_ORDER, STATUS_ORDER } from "@/lib/domain"
import { sampleTasks, users } from "./sampleData"
import { TaskDrawerPreview } from "./TaskDrawerPreview"

const SECTIONS = [
  { id: "cores", label: "Cores" },
  { id: "tipografia", label: "Tipografia" },
  { id: "forma", label: "Forma e profundidade" },
  { id: "botoes", label: "Botões" },
  { id: "campos", label: "Campos" },
  { id: "selos", label: "Selos e metadados" },
  { id: "card", label: "Card de tarefa" },
  { id: "colunas", label: "Colunas e estados vazios" },
  { id: "sobreposicoes", label: "Modais, drawer e toasts" },
  { id: "rapida", label: "Criação rápida e filtros" },
]

/** Guia visual do sistema, exibido em Configurações → Design system. */
export function DesignSystemPage() {
  return (
    <div className="space-y-20">
      <Intro />
      <ColorsSection />
      <TypographySection />
      <ShapeSection />
      <ButtonsSection />
      <FieldsSection />
      <BadgesSection />
      <CardSection />
      <ColumnsSection />
      <OverlaysSection />
      <QuickCreateSection />
    </div>
  )
}

/* ───────────────────────── helpers ───────────────────────── */

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  const index = SECTIONS.findIndex((s) => s.id === id) + 1
  return (
    <section id={id} className="scroll-mt-24 space-y-6">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-brand-600 tabular-nums">{String(index).padStart(2, "0")}</p>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="max-w-2xl text-[15px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-3xl bg-surface p-6 shadow-card sm:p-8", className)}>{children}</div>
}

function Caption({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-ink-3">{children}</p>
}

/* ───────────────────────── seções ───────────────────────── */

function Intro() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-brand-50 px-8 py-12 sm:px-12">
      <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-brand-100 blur-2xl" />
      <div className="relative max-w-xl space-y-4">
        <Badge variant="outline">v1 · Outubro 2026</Badge>
        <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-ink sm:text-5xl">
          Calmo, claro e <span className="text-brand-600">focado no que importa.</span>
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Base branca, muito respiro e o violeta reservado para ações principais, destaques e estado
          ativo. Cantos arredondados, sombras difusas e quase nenhuma borda.
        </p>
      </div>
    </div>
  )
}

function Swatch({ name, value, className, dark }: { name: string; value: string; className: string; dark?: boolean }) {
  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex h-20 items-end rounded-2xl p-3 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.04)]",
          className
        )}
      >
        <span className={cn("text-[11px] font-semibold", dark ? "text-white/90" : "text-ink-2")}>{value}</span>
      </div>
      <p className="text-xs font-medium text-ink-2">{name}</p>
    </div>
  )
}

function ColorsSection() {
  return (
    <Section
      id="cores"
      title="Cores"
      description="O violeta aparece pouco, e por isso chama atenção quando aparece. O resto da interface vive em tons neutros levemente frios."
    >
      <Panel className="space-y-8">
        <div className="space-y-3">
          <Caption>Violeta: ação principal, destaque, estado ativo</Caption>
          <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
            <Swatch name="brand-50" value="#F6F3FF" className="bg-brand-50" />
            <Swatch name="brand-100" value="#EDE8FE" className="bg-brand-100" />
            <Swatch name="brand-200" value="#DDD3FD" className="bg-brand-200" />
            <Swatch name="brand-300" value="#C4B2FB" className="bg-brand-300" />
            <Swatch name="brand-500" value="#8B5CF6" className="bg-brand-500" dark />
            <Swatch name="brand-600 ★" value="#7C3AED" className="bg-brand-600" dark />
            <Swatch name="brand-700" value="#6D28D9" className="bg-brand-700" dark />
            <Swatch name="brand-900" value="#3B1A78" className="bg-brand-900" dark />
          </div>
        </div>
        <div className="space-y-3">
          <Caption>Neutros: superfícies e texto</Caption>
          <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
            <Swatch name="surface" value="#FFFFFF" className="bg-surface" />
            <Swatch name="sunken" value="#F6F6F8" className="bg-surface-sunken" />
            <Swatch name="hairline" value="#ECECF0" className="bg-hairline" />
            <Swatch name="ink-4" value="#C4C4CB" className="bg-ink-4" />
            <Swatch name="ink-3" value="#8A8A93" className="bg-ink-3" dark />
            <Swatch name="ink-2" value="#52525B" className="bg-ink-2" dark />
            <Swatch name="ink" value="#18181B" className="bg-ink" dark />
          </div>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="space-y-3">
            <Caption>Feedback: prazos e estados (sempre em versão suave)</Caption>
            <div className="grid grid-cols-3 gap-4">
              <Swatch name="Vencido" value="#DC3A3F" className="bg-danger-soft" />
              <Swatch name="Vence em ≤ 2 dias" value="#B86E00" className="bg-warning-soft" />
              <Swatch name="Concluído" value="#1F9D55" className="bg-success-soft" />
            </div>
          </div>
          <div className="space-y-3">
            <Caption>Prioridade: só um ponto, para não brigar com o violeta</Caption>
            <div className="flex h-20 items-center gap-6 rounded-2xl bg-surface-sunken px-5">
              {PRIORITY_ORDER.map((p) => (
                <PriorityDot key={p} priority={p} showLabel />
              ))}
            </div>
          </div>
        </div>
      </Panel>
    </Section>
  )
}

function TypographySection() {
  const rows = [
    { name: "Display", spec: "40 / semibold / -2%", el: <p className="text-[40px] leading-tight font-semibold tracking-tight">Quadro do TI</p> },
    { name: "Título", spec: "24 / semibold", el: <p className="text-2xl font-semibold tracking-tight">Renovar certificado SSL</p> },
    { name: "Título do drawer", spec: "20 / semibold", el: <p className="text-xl font-semibold tracking-tight">Migrar caixas de e-mail do financeiro</p> },
    { name: "Corpo", spec: "14 / regular", el: <p className="text-sm text-ink-2">Mover as 14 caixas mantendo regras e assinaturas.</p> },
    { name: "Título do card", spec: "14 / medium", el: <p className="text-sm font-medium">Trocar fonte do switch do 2º andar</p> },
    { name: "Meta", spec: "12 / medium / ink-3", el: <p className="text-xs font-medium text-ink-3">Infra · Amanhã · 2/4</p> },
    { name: "Rótulo de seção", spec: "12 / semibold / caixa alta", el: <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Checklist de pronto</p> },
  ]
  return (
    <Section
      id="tipografia"
      title="Tipografia"
      description="Inter Variable, servida pelo próprio sistema (sem depender do Google Fonts na rede interna). A hierarquia vem do peso e do tom de cinza, não do tamanho exagerado."
    >
      <Panel className="divide-y divide-hairline p-0 sm:p-0">
        {rows.map((r) => (
          <div key={r.name} className="flex flex-col gap-2 px-6 py-5 sm:flex-row sm:items-center sm:gap-8 sm:px-8">
            <div className="w-44 shrink-0">
              <p className="text-[13px] font-medium text-ink">{r.name}</p>
              <p className="text-xs text-ink-3">{r.spec}</p>
            </div>
            <div className="min-w-0 text-ink">{r.el}</div>
          </div>
        ))}
      </Panel>
    </Section>
  )
}

function ShapeSection() {
  return (
    <Section
      id="forma"
      title="Forma e profundidade"
      description="Nada de bordas duras: a separação vem de sombra difusa e de fundos levemente diferentes."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="space-y-4">
          <Caption>Raios</Caption>
          <div className="flex flex-wrap items-end gap-5">
            {[
              { r: "rounded-lg", label: "10 · selos" },
              { r: "rounded-xl", label: "14 · cards" },
              { r: "rounded-3xl", label: "24 · painéis" },
              { r: "rounded-full", label: "pill · botões" },
            ].map((x) => (
              <div key={x.r} className="space-y-2 text-center">
                <div className={cn("size-16 bg-brand-100", x.r)} />
                <p className="text-[11px] font-medium text-ink-3">{x.label}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="space-y-4 bg-surface-sunken shadow-none">
          <Caption>Sombras</Caption>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {[
              { s: "shadow-card", label: "Card" },
              { s: "shadow-card-hover", label: "Hover" },
              { s: "shadow-pop", label: "Menu / modal" },
              { s: "shadow-lift", label: "Arrastando" },
            ].map((x) => (
              <div key={x.s} className="space-y-2 text-center">
                <div className={cn("h-16 rounded-xl bg-surface", x.s)} />
                <p className="text-[11px] font-medium text-ink-3">{x.label}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </Section>
  )
}

function ButtonsSection() {
  const [saving, setSaving] = useState(false)
  const save = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast.success("Alterações salvas")
    }, 900)
  }
  return (
    <Section
      id="botoes"
      title="Botões"
      description="Formato pill. A cor mostra o resultado da ação: violeta para ações principais neutras, verde quando conclui, âmbar quando devolve, vermelho quando bloqueia ou exclui, cinza quando não está disponível."
    >
      <Panel className="space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <Plus /> Nova tarefa
          </Button>
          <Button variant="soft">
            <Send /> Enviar para revisão
          </Button>
          <Button variant="outline">Filtros</Button>
          <Button variant="secondary">Cancelar</Button>
          <Button variant="ghost">Ver histórico</Button>
          <Button variant="warning">
            <Undo2 /> Devolver
          </Button>
          <Button variant="destructive">
            <Ban /> Bloquear
          </Button>
          <Button variant="destructive">
            <Trash2 /> Excluir
          </Button>
          <Button variant="link">Saiba mais</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" variant="success">
            <Check /> Aprovar e concluir
          </Button>
          <Button>Padrão</Button>
          <Button size="sm">Pequeno</Button>
          <Button size="xs" variant="soft">
            Mini
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Mais opções">
                <MoreHorizontal />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mais opções</TooltipContent>
          </Tooltip>
          <Button size="icon" variant="outline" aria-label="Adicionar">
            <Plus />
          </Button>
          <Button disabled>Desabilitado</Button>
        </div>
        <div className="grid gap-x-6 gap-y-2 rounded-2xl bg-surface-sunken px-5 py-4 text-[13px] text-ink-2 sm:grid-cols-2">
          <p><span className="mr-2 inline-block size-2 rounded-full bg-brand-600" />Violeta: criar, salvar, enviar para revisão</p>
          <p><span className="mr-2 inline-block size-2 rounded-full bg-success" />Verde: aprovar e concluir</p>
          <p><span className="mr-2 inline-block size-2 rounded-full bg-warning" />Âmbar: devolver</p>
          <p><span className="mr-2 inline-block size-2 rounded-full bg-danger" />Vermelho: bloquear, excluir</p>
          <p><span className="mr-2 inline-block size-2 rounded-full bg-ink-4" />Cinza: indisponível no momento</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} aria-busy={saving} className={cn("min-w-[132px]", saving && "pointer-events-none")}>
            {saving ? (
              <>
                <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Salvando…
              </>
            ) : (
              "Testar salvar"
            )}
          </Button>
          <Caption>← clique para ver o feedback de salvar</Caption>
        </div>
      </Panel>
    </Section>
  )
}

function FieldsSection() {
  const [checked, setChecked] = useState(true)
  const { activeCategories } = useAppConfig()
  return (
    <Section id="campos" title="Campos" description="Fundo cinza bem leve no repouso; ao focar, vira branco com um halo violeta suave.">
      <Panel className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ds-title">Título</Label>
          <Input id="ds-title" placeholder="Ex.: Trocar toner da impressora do RH" />
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select defaultValue="infra">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {activeCategories.map(({ key: c }) => (
                <SelectItem key={c} value={c}>
                  <CategoryLabel category={c} className="text-sm text-ink" />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ds-desc">Descrição</Label>
          <Textarea id="ds-desc" placeholder="Contexto, links, número do chamado…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ds-error">Motivo (obrigatório)</Label>
          <Input id="ds-error" aria-invalid placeholder="Descreva o motivo" />
          <p className="text-xs text-danger">Informe o motivo para continuar.</p>
        </div>
        <div className="space-y-3">
          <Label>Checklist</Label>
          <label className="flex items-center gap-3 text-sm text-ink">
            <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
            Mudança testada em homologação
          </label>
          <label className="flex items-center gap-3 text-sm text-ink">
            <Checkbox /> Documentação atualizada
          </label>
        </div>
      </Panel>
    </Section>
  )
}

function BadgesSection() {
  const [now] = useState(() => new Date())
  const { statusLabel, activeCategories } = useAppConfig()
  const d = (n: number) => toDateOnly(addDays(now, n))
  return (
    <Section id="selos" title="Selos e metadados" description="Informação secundária fica em cinza; cor só quando exige atenção.">
      <Panel className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <Caption>Status</Caption>
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            {STATUS_ORDER.map((s) => (
              <span key={s} className="inline-flex items-center gap-2 text-[13px] font-medium text-ink">
                <StatusIcon status={s} /> {statusLabel(s)}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Caption>Categorias</Caption>
          <div className="flex flex-wrap gap-2">
            {activeCategories.map(({ key: c }) => (
              <CategoryChip key={c} category={c} />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Caption>Prazos</Caption>
          <div className="flex flex-wrap items-center gap-4">
            <DueChip dueDate={d(-3)} />
            <DueChip dueDate={d(0)} />
            <DueChip dueDate={d(2)} />
            <DueChip dueDate={d(10)} />
          </div>
        </div>
        <div className="space-y-3">
          <Caption>Avatares (passe o mouse)</Caption>
          <div className="flex items-center gap-4">
            <UserAvatar user={users.marcos} size="lg" />
            <UserAvatar user={users.rafael} />
            <UserAvatar user={users.juliana} size="sm" />
            <div className="flex -space-x-2">
              <UserAvatar user={users.marcos} size="sm" />
              <UserAvatar user={users.rafael} size="sm" />
              <UserAvatar user={users.juliana} size="sm" />
            </div>
          </div>
        </div>
        <div className="space-y-3 md:col-span-2">
          <Caption>Selos genéricos</Caption>
          <div className="flex flex-wrap gap-2">
            <Badge>Neutro</Badge>
            <Badge variant="brand">Destaque</Badge>
            <Badge variant="solid">3 novas</Badge>
            <Badge variant="success">
              <Check /> Aprovada
            </Badge>
            <Badge variant="warning">
              <Undo2 /> Devolvida
            </Badge>
            <Badge variant="danger">
              <Ban /> Bloqueada
            </Badge>
            <Badge variant="outline">Gestor</Badge>
          </div>
        </div>
      </Panel>
    </Section>
  )
}

function CardSection() {
  const [rejected, setRejected] = useState(false)
  const reject = () => {
    setRejected(true)
    toast.error("Faltam 3 itens do checklist", {
      description: "Marque o checklist inteiro para enviar à Revisão.",
    })
    setTimeout(() => setRejected(false), 400)
  }

  const states = [
    { label: "Vence em até 2 dias", task: sampleTasks.soon },
    { label: "Vencida", task: sampleTasks.overdue },
    { label: "Normal", task: sampleTasks.normal },
    { label: "Bloqueada (motivo obrigatório)", task: sampleTasks.blocked },
    { label: "Devolvida pelo gestor", task: sampleTasks.returned },
    { label: "Concluída", task: sampleTasks.done },
    { label: "Sem responsável", task: sampleTasks.unassigned },
    { label: "Checklist completo", task: sampleTasks.review },
  ]

  return (
    <Section
      id="card"
      title="Card de tarefa"
      description="Categoria e prioridade no topo, título com até duas linhas, e no rodapé o que importa no dia a dia: prazo, checklist e responsável."
    >
      <div className="rounded-3xl bg-surface-sunken p-6 sm:p-8">
        <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-4">
          {states.map((s) => (
            <div key={s.label} className="space-y-2.5">
              <Caption>{s.label}</Caption>
              <TaskCard task={s.task} />
            </div>
          ))}
          <div className="space-y-2.5">
            <Caption>Sendo arrastado</Caption>
            <TaskCard task={sampleTasks.soon} lifted />
          </div>
          <div className="space-y-2.5">
            <Caption>Onde vai cair</Caption>
            <TaskCardPlaceholder />
          </div>
          <div className="space-y-2.5 sm:col-span-2">
            <Caption>Recusado ao soltar (clique no botão)</Caption>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <TaskCard task={sampleTasks.overdue} rejected={rejected} className="sm:w-[calc(50%-10px)]" />
              <Button variant="outline" size="sm" onClick={reject}>
                Simular recusa
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}

function ColumnsSection() {
  return (
    <Section
      id="colunas"
      title="Colunas e estados vazios"
      description="Durante o arraste a coluna que aceita o card acende; a que não aceita apaga e explica por quê. Coluna vazia sempre orienta o próximo passo."
    >
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
        <div className="flex h-[560px] gap-4">
          <BoardColumn status="todo" count={2} onAdd={() => toast("Atalho: aperte N em qualquer lugar do quadro")}>
            <TaskCard task={sampleTasks.soon} />
            <TaskCard task={sampleTasks.normal} />
          </BoardColumn>
          <BoardColumn status="in_progress" count={2} dropState="accept">
            <TaskCard task={sampleTasks.overdue} />
            <TaskCardPlaceholder />
            <TaskCard task={sampleTasks.returned} />
          </BoardColumn>
          <BoardColumn
            status="review"
            count={0}
            dropState="deny"
            denyReason="Só entra aqui com o checklist 100% marcado."
          />
          <BoardColumn status="done" count={0} />
          <BoardColumn status="blocked" count={0} />
        </div>
      </div>
      <Panel>
        <div className="grid gap-4 sm:grid-cols-3">
          <EmptyColumn status="todo" className="bg-surface-sunken" />
          <EmptyColumn status="review" className="bg-surface-sunken" />
          <EmptyColumn status="blocked" className="bg-surface-sunken" />
        </div>
      </Panel>
    </Section>
  )
}

function OverlaysSection() {
  const [reason, setReason] = useState("")
  return (
    <Section
      id="sobreposicoes"
      title="Modais, drawer e toasts"
      description="O detalhe da tarefa abre em um painel lateral flutuante, sem trocar de página. Modais só para pedir um motivo ou confirmar."
    >
      <Panel className="flex flex-wrap items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button>Abrir detalhe da tarefa</Button>
          </SheetTrigger>
          <TaskDrawerPreview />
        </Sheet>

        <Dialog onOpenChange={() => setReason("")}>
          <DialogTrigger asChild>
            <Button variant="warning">
              <Undo2 /> Devolver (modal)
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <span className="mb-2 grid size-10 place-items-center rounded-2xl bg-warning-soft text-warning">
                <Undo2 className="size-5" />
              </span>
              <DialogTitle>Devolver para Em andamento</DialogTitle>
              <DialogDescription>
                Explique o que falta. O motivo fica no histórico e aparece no card até ele voltar para a Revisão.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: faltou validar o acesso pelo celular da diretoria"
            />
            <DialogFooter showCloseButton>
              <DialogClose asChild>
                <Button
                  disabled={reason.trim().length < 3}
                  onClick={() => toast("Tarefa devolvida para Em andamento", { icon: <Undo2 className="size-4 text-warning" /> })}
                >
                  Devolver
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Menu do card <ChevronDown className="text-ink-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>TI-104</DropdownMenuLabel>
            <DropdownMenuItem>
              <Pencil /> Editar <DropdownMenuShortcut>E</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Ban /> Marcar como bloqueada
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <Trash2 /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="secondary" onClick={() => toast.success("Tarefa aprovada e concluída")}>
          Toast de sucesso
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast("Card movido para Em andamento", {
              action: { label: "Desfazer", onClick: () => {} },
            })
          }
        >
          Toast com desfazer
        </Button>
      </Panel>
    </Section>
  )
}

function QuickCreateSection() {
  const [active, setActive] = useState(true)
  const { priority } = useAppConfig()
  return (
    <Section
      id="rapida"
      title="Criação rápida e filtros"
      description="Tecla N abre um campo único. Atalhos opcionais na mesma linha: #categoria, !prioridade, @pessoa e datas como “amanhã” ou “sexta”."
    >
      <div className="space-y-6 rounded-3xl bg-surface-sunken p-6 sm:p-10">
        {/* Barra superior + filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
            <Input placeholder="Buscar tarefas" className="rounded-full bg-surface pl-10 shadow-card hover:bg-surface" />
            <Kbd className="absolute top-1/2 right-3 -translate-y-1/2">/</Kbd>
          </div>
          <FilterPill label="Responsável" />
          <FilterPill label="Categoria" />
          {active ? (
            <button
              onClick={() => setActive(false)}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-brand-50 pr-2.5 pl-3.5 text-[13px] font-medium text-brand-700 transition-colors hover:bg-brand-100"
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: priority("urgent").color }} />
              Prioridade: Urgente
              <X className="size-3.5" />
            </button>
          ) : (
            <FilterPill label="Prioridade" onClick={() => setActive(true)} />
          )}
          <div className="ml-auto flex items-center gap-3">
            <div className="flex -space-x-2">
              <UserAvatar user={users.marcos} size="sm" />
              <UserAvatar user={users.rafael} size="sm" />
              <UserAvatar user={users.juliana} size="sm" />
            </div>
            <Button size="icon-sm" variant="ghost" aria-label="Sair">
              <LogOut />
            </Button>
          </div>
        </div>

        {/* Quick create */}
        <div className="mx-auto max-w-2xl animate-pop-in rounded-3xl bg-surface p-2 shadow-pop">
          <div className="flex items-center gap-3 px-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-white shadow-brand">
              <Plus className="size-4" />
            </span>
            <input
              className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
              defaultValue="Trocar toner da impressora do RH #infra !alta @juliana amanhã"
              aria-label="Nova tarefa"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-3 pt-2.5 pb-1.5">
            <CategoryChip category="infra" className="h-6" />
            <span className="inline-flex h-6 items-center rounded-full bg-surface-sunken px-2.5">
              <PriorityDot priority="high" showLabel />
            </span>
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-surface-sunken pr-2.5 pl-0.5 text-xs font-medium text-ink-2">
              <UserAvatar user={users.juliana} size="sm" withTooltip={false} className="size-5 ring-0" />
              Juliana
            </span>
            <span className="inline-flex h-6 items-center rounded-full bg-warning-soft px-2.5 text-xs font-medium text-warning">
              Amanhã
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-3">
              <Kbd>
                <CornerDownLeft />
              </Kbd>
              criar
              <Kbd className="ml-2">Esc</Kbd>
              fechar
            </span>
          </div>
        </div>
        <p className="text-center text-xs text-ink-3">
          Visual apenas. O atalho N e a leitura dos atalhos de texto entram na fase 6.
        </p>
      </div>
    </Section>
  )
}

function FilterPill({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13px] font-medium text-ink-2 shadow-card transition-[box-shadow,color] hover:text-ink hover:shadow-card-hover"
    >
      {label}
      <ChevronDown className="size-3.5 text-ink-3" />
    </button>
  )
}
