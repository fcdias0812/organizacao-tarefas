import { useState } from "react"
import { ArrowDown, ArrowUp, ListChecks, MoreHorizontal, Pencil, Plus, Power, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { CATEGORY_ICONS, type CategoryDTO, type CategoryIcon } from "@tarefas/shared"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  useAdminCategories,
  useCreateCategory,
  useDeleteCategory,
  useReorderCategories,
  useUpdateCategory,
} from "@/features/settings/useAdmin"
import { categoryIcon } from "@/lib/categoryIcons"
import { Field, Panel, SettingsSection } from "./parts"

export function CategoriesTab() {
  const categories = useAdminCategories()
  const update = useUpdateCategory()
  const reorder = useReorderCategories()
  const remove = useDeleteCategory()
  const [editing, setEditing] = useState<CategoryDTO | "new" | null>(null)
  const [deleting, setDeleting] = useState<CategoryDTO | null>(null)
  const list = categories.data ?? []

  const move = (index: number, delta: number) => {
    const keys = list.map((c) => c.key)
    const [key] = keys.splice(index, 1)
    keys.splice(index + delta, 0, key)
    reorder.mutate(keys)
  }

  return (
    <SettingsSection
      title="Categorias"
      description={
        <>
          Cada categoria tem um <strong className="font-semibold text-ink">checklist padrão de pronto</strong>, copiado para o
          card quando a tarefa é criada. Deixe sem itens para o card nascer vazio. A primeira categoria ativa é a padrão da
          criação rápida.
        </>
      }
      actions={
        <Button onClick={() => setEditing("new")}>
          <Plus /> Nova categoria
        </Button>
      }
    >
      <Panel className="divide-y divide-hairline p-0 sm:p-0">
        {categories.isPending && <p className="px-6 py-8 text-sm text-ink-3">Carregando…</p>}
        {list.map((c, i) => {
          const Icon = categoryIcon(c.icon)
          return (
            <div key={c.key} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6", !c.isActive && "opacity-55")}>
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Subir ${c.name}`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="grid size-5 place-items-center rounded text-ink-3 hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Descer ${c.name}`}
                  disabled={i === list.length - 1}
                  onClick={() => move(i, 1)}
                  className="grid size-5 place-items-center rounded text-ink-3 hover:bg-surface-sunken hover:text-ink disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
              <span className="grid size-10 place-items-center rounded-2xl bg-surface-sunken text-ink-2">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {c.name}
                  {i === 0 && c.isActive && <span className="ml-2 text-xs font-normal text-ink-3">padrão</span>}
                </p>
                <p className="flex flex-wrap gap-x-3 text-xs text-ink-3">
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="size-3.5" />
                    {c.checklistTemplate.length === 0
                      ? "Sem checklist padrão"
                      : `${c.checklistTemplate.length} ${c.checklistTemplate.length === 1 ? "item" : "itens"} no checklist`}
                  </span>
                  <span>
                    {c.taskCount ?? 0} {c.taskCount === 1 ? "tarefa" : "tarefas"}
                  </span>
                </p>
              </div>
              {!c.isActive && <Badge variant="outline">Desativada</Badge>}
              <Button variant="ghost" size="icon-sm" aria-label={`Editar ${c.name}`} onClick={() => setEditing(c)}>
                <Pencil />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Mais ações para ${c.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onSelect={() =>
                      update.mutate(
                        { key: c.key, patch: { isActive: !c.isActive } },
                        { onSuccess: () => toast.success(c.isActive ? `${c.name} desativada` : `${c.name} reativada`) }
                      )
                    }
                  >
                    <Power /> {c.isActive ? "Desativar" : "Reativar"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c)}>
                    <Trash2 /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </Panel>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <CategoryForm key={editing === "new" ? "new" : editing.key} category={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
        )}
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        {deleting && (
          <DialogContent>
            <DialogHeader>
              <span className="mb-2 grid size-10 place-items-center rounded-2xl bg-danger-soft text-danger">
                <Trash2 className="size-5" />
              </span>
              <DialogTitle>Excluir “{deleting.name}”?</DialogTitle>
              <DialogDescription>
                {deleting.taskCount
                  ? `Essa categoria tem ${deleting.taskCount === 1 ? "1 tarefa" : `${deleting.taskCount} tarefas`} e não pode ser excluída, para não perder o histórico. Desative-a: ela some das opções, mas as tarefas antigas continuam com ela.`
                  : "A categoria e o checklist padrão dela serão apagados. Isso não pode ser desfeito."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton>
              {deleting.taskCount ? (
                deleting.isActive && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      update.mutate({ key: deleting.key, patch: { isActive: false } })
                      setDeleting(null)
                    }}
                  >
                    <Power /> Desativar
                  </Button>
                )
              ) : (
                <Button
                  variant="destructive"
                  onClick={() =>
                    remove.mutate(deleting.key, {
                      onSuccess: () => {
                        toast.success("Categoria excluída")
                        setDeleting(null)
                      },
                    })
                  }
                >
                  <Trash2 /> Excluir
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </SettingsSection>
  )
}

function CategoryForm({ category, onClose }: { category: CategoryDTO | null; onClose: () => void }) {
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const [name, setName] = useState(category?.name ?? "")
  const [icon, setIcon] = useState<CategoryIcon>((category?.icon as CategoryIcon) ?? "tag")
  const [items, setItems] = useState<string[]>(category?.checklistTemplate ?? [])
  const [draft, setDraft] = useState("")
  const pending = create.isPending || update.isPending
  const cleanItems = items.map((i) => i.trim()).filter(Boolean)
  const valid = name.trim().length >= 2

  const addItem = () => {
    const label = draft.trim()
    if (!label) return
    setItems([...items, label])
    setDraft("")
  }
  const moveItem = (i: number, delta: number) => {
    const next = [...items]
    const [item] = next.splice(i, 1)
    next.splice(i + delta, 0, item)
    setItems(next)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    const payload = { name: name.trim(), icon, checklistTemplate: cleanItems }
    const done = () => {
      toast.success(category ? "Categoria atualizada" : "Categoria criada")
      onClose()
    }
    if (category) update.mutate({ key: category.key, patch: payload }, { onSuccess: done })
    else create.mutate(payload, { onSuccess: done })
  }

  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
      <form onSubmit={submit} className="grid gap-5">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          <DialogDescription>
            O checklist padrão vale para as tarefas criadas daqui em diante. As que já existem continuam com o checklist que têm.
          </DialogDescription>
        </DialogHeader>

        <Field label="Nome" htmlFor="category-name" hint="Também vira atalho na criação rápida (ex.: #telefoniaip).">
          <Input id="category-name" autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Ícone">
          <div className="grid grid-cols-10 gap-1.5">
            {CATEGORY_ICONS.map((name) => {
              const Icon = categoryIcon(name)
              return (
                <button
                  key={name}
                  type="button"
                  aria-label={name}
                  aria-pressed={icon === name}
                  onClick={() => setIcon(name)}
                  className={cn(
                    "grid aspect-square place-items-center rounded-xl text-ink-2 transition-colors hover:bg-surface-sunken",
                    icon === name && "bg-brand-50 text-brand-700 shadow-[inset_0_0_0_1.5px_var(--brand-300)]"
                  )}
                >
                  <Icon className="size-4" />
                </button>
              )
            })}
          </div>
        </Field>

        <Field
          label="Checklist padrão de pronto"
          hint={items.length === 0 ? "Sem itens: o card nasce com o checklist vazio e quem executa adiciona os seus." : undefined}
        >
          <ul className="space-y-1.5">
            {items.map((item, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="w-5 text-right text-xs text-ink-4 tabular-nums">{i + 1}</span>
                <Input
                  value={item}
                  maxLength={200}
                  aria-label={`Item ${i + 1}`}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))}
                  className="h-9"
                />
                <Button type="button" variant="ghost" size="icon-xs" aria-label="Subir item" disabled={i === 0} onClick={() => moveItem(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Descer item"
                  disabled={i === items.length - 1}
                  onClick={() => moveItem(i, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remover item"
                  className="hover:bg-danger-soft hover:text-danger"
                  onClick={() => setItems(items.filter((_, j) => j !== i))}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 pl-6.5">
            <Input
              value={draft}
              maxLength={200}
              placeholder="Novo item (Enter adiciona)"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addItem()
                }
              }}
              className="h-9"
            />
            <Button type="button" variant="soft" size="sm" onClick={addItem} disabled={!draft.trim()}>
              <Plus /> Adicionar
            </Button>
          </div>
        </Field>

        <DialogFooter showCloseButton>
          <Button type="submit" disabled={!valid || pending}>
            {pending ? "Salvando…" : category ? "Salvar" : "Criar categoria"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
