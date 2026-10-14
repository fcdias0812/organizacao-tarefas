import { useState } from "react"
import { Archive, ArchiveRestore } from "lucide-react"
import { toast } from "sonner"
import { checkArchive, type UserDTO } from "@tarefas/shared"

import { CategoryLabel } from "@/components/task/TaskMeta"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useArchiveActions, useArchivedTasks } from "@/features/task/useArchive"
import { formatFullDateTime, formatRelative } from "@/lib/dates"

/**
 * Botão "Arquivadas" ao lado dos filtros: lista as tarefas que saíram do quadro, com
 * quem arquivou e quando. Dá para abrir (só leitura) ou restaurar para o quadro.
 */
export function ArchivedSheet({ me, users, onOpenTask }: { me: UserDTO; users: UserDTO[]; onOpenTask: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  const archived = useArchivedTasks(open)
  const { restore } = useArchiveActions()
  const name = (id: number | null) => users.find((u) => u.id === id)?.name.split(" ")[0] ?? "alguém"

  return (
    <>
      <Button variant="ghost" size="sm" className="h-9 text-ink-2" onClick={() => setOpen(true)}>
        <Archive /> Arquivadas
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="gap-0 sm:max-w-lg">
          <SheetHeader className="px-7 pt-6 pb-4">
            <SheetTitle>Tarefas arquivadas</SheetTitle>
            <SheetDescription>Fora do quadro, com o histórico guardado. Restaure para voltar a trabalhar nelas.</SheetDescription>
          </SheetHeader>

          <div className="scroll-soft flex-1 overflow-y-auto px-4 pb-6">
            {archived.isPending ? (
              <p className="px-3 py-6 text-sm text-ink-3">Carregando…</p>
            ) : archived.isError ? (
              <p className="px-3 py-6 text-sm text-danger">{archived.error.message}</p>
            ) : archived.data.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-ink-3">Nenhuma tarefa arquivada.</p>
            ) : (
              <ul className="space-y-2">
                {archived.data.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 rounded-xl bg-surface p-3 shadow-card">
                    <button
                      type="button"
                      className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
                      onClick={() => {
                        setOpen(false)
                        onOpenTask(task.id)
                      }}
                    >
                      <span className="flex items-center gap-2 text-xs text-ink-3">
                        <span className="tabular-nums">TI-{task.id}</span>
                        <CategoryLabel category={task.category} />
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-medium text-ink">{task.title}</span>
                      <span className="block text-xs text-ink-3" title={formatFullDateTime(task.archivedAt!)}>
                        Arquivada por {name(task.archivedById)} {formatRelative(task.archivedAt!)}
                      </span>
                    </button>
                    {checkArchive(me, task).ok && (
                      <Button
                        variant="soft"
                        size="sm"
                        disabled={restore.isPending}
                        onClick={() => restore.mutate(task.id, { onSuccess: () => toast.success("Tarefa restaurada para o quadro") })}
                      >
                        <ArchiveRestore /> Restaurar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
