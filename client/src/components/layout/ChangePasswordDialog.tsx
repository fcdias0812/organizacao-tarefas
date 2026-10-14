import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { KeyRound } from "lucide-react"
import { toast } from "sonner"
import { PASSWORD_MIN_LENGTH } from "@tarefas/shared"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"

/** Troca da própria senha (qualquer usuário). As outras sessões da pessoa são encerradas. */
export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <ChangePasswordForm onDone={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const change = useMutation({
    mutationFn: () => api<void>("POST", "/auth/password", { currentPassword: current, newPassword: next }),
    onSuccess: () => {
      toast.success("Senha alterada", { description: "As outras sessões abertas com a sua conta foram encerradas." })
      onDone()
    },
  })

  const tooShort = next.length > 0 && next.length < PASSWORD_MIN_LENGTH
  const mismatch = confirm.length > 0 && confirm !== next
  const valid = current.length > 0 && next.length >= PASSWORD_MIN_LENGTH && confirm === next

  return (
    <DialogContent>
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) change.mutate()
        }}
      >
        <DialogHeader>
          <span className="mb-2 grid size-10 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <KeyRound className="size-5" />
          </span>
          <DialogTitle>Alterar senha</DialogTitle>
          <DialogDescription>Use pelo menos {PASSWORD_MIN_LENGTH} caracteres. Uma frase curta é mais fácil de lembrar e mais difícil de adivinhar.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="pw-current">Senha atual</Label>
            <Input id="pw-current" type="password" autoComplete="current-password" autoFocus value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw-new">Nova senha</Label>
            <Input id="pw-new" type="password" autoComplete="new-password" value={next} aria-invalid={tooShort || undefined} onChange={(e) => setNext(e.target.value)} />
            {tooShort && <p className="text-xs text-danger">Faltam {PASSWORD_MIN_LENGTH - next.length} caracteres.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw-confirm">Confirme a nova senha</Label>
            <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} aria-invalid={mismatch || undefined} onChange={(e) => setConfirm(e.target.value)} />
            {mismatch && <p className="text-xs text-danger">As senhas não conferem.</p>}
          </div>
          {change.error && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-[13px] text-danger">{change.error.message}</p>}
        </div>

        <DialogFooter showCloseButton>
          <Button type="submit" disabled={!valid || change.isPending}>
            {change.isPending ? "Salvando…" : "Alterar senha"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
