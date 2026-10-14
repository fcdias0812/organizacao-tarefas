import { useState } from "react"
import { Ban, Undo2 } from "lucide-react"
import { REASON_MAX_LENGTH } from "@tarefas/shared"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { Textarea } from "@/components/ui/textarea"
import { useAppConfig } from "@/features/settings/appConfig"

export type ReasonKind = "block" | "return"

const COPY: Record<
  ReasonKind,
  { title: string; description: string; placeholder: string; confirm: string }
> = {
  block: {
    title: "Bloquear tarefa",
    description: "O que está impedindo o andamento? O motivo aparece no card até ele ser desbloqueado.",
    placeholder: "Ex.: aguardando a operadora liberar o IP fixo (protocolo 88213)",
    confirm: "Bloquear",
  },
  return: {
    title: "Devolver para Em andamento",
    description: "Explique o que falta. O motivo fica no histórico e aparece no card até ele voltar para a Revisão.",
    placeholder: "Ex.: faltou validar o acesso pelo celular da diretoria",
    confirm: "Devolver",
  },
}

interface ReasonDialogProps {
  kind: ReasonKind | null
  taskTitle?: string
  onConfirm: (reason: string) => void
  onCancel: () => void
}

/** Pede o motivo obrigatório para bloquear ou devolver um card. */
export function ReasonDialog({ kind, taskTitle, onConfirm, onCancel }: ReasonDialogProps) {
  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onCancel()}>
      {kind && <ReasonForm key={kind + taskTitle} kind={kind} taskTitle={taskTitle} onConfirm={onConfirm} />}
    </Dialog>
  )
}

function ReasonForm({ kind, taskTitle, onConfirm }: { kind: ReasonKind; taskTitle?: string; onConfirm: (r: string) => void }) {
  const [reason, setReason] = useState("")
  const { settings, statusLabel } = useAppConfig()
  const copy = COPY[kind]
  const title = kind === "return" ? `Devolver para ${statusLabel("in_progress")}` : copy.title
  const description =
    kind === "return"
      ? `Explique o que falta. O motivo fica no histórico e aparece no card até ele voltar para ${statusLabel("review")}.`
      : copy.description
  const valid = reason.trim().length >= settings.reasonMinLength
  const submit = () => valid && onConfirm(reason.trim())

  return (
    <DialogContent>
      <DialogHeader>
        <span
          className={cn(
            "mb-2 grid size-10 place-items-center rounded-2xl",
            kind === "block" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"
          )}
        >
          {kind === "block" ? <Ban className="size-5" /> : <Undo2 className="size-5" />}
        </span>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {taskTitle && <span className="mb-1 block font-medium text-ink">{taskTitle}</span>}
          {description}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Textarea
          autoFocus
          value={reason}
          maxLength={REASON_MAX_LENGTH}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={copy.placeholder}
          aria-label="Motivo"
        />
        <p className="flex items-center justify-between text-xs text-ink-3">
          <span className="inline-flex items-center gap-1">
            <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> para confirmar
          </span>
          <span className="tabular-nums">
            {reason.length}/{REASON_MAX_LENGTH}
          </span>
        </p>
      </div>

      <DialogFooter showCloseButton>
        <Button variant={kind === "block" ? "destructive" : "warning"} disabled={!valid} onClick={submit}>
          {kind === "block" ? <Ban /> : <Undo2 />}
          {copy.confirm}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
