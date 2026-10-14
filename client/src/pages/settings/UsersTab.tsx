import { useState } from "react"
import { Check, Copy, KeyRound, MoreHorizontal, Pencil, Power, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { AVATAR_COLORS as AVATAR_COLOR_KEYS, type AdminUserDTO, type AvatarColor, type UserDTO } from "@tarefas/shared"
import { cn } from "cn"

import { UserAvatar } from "@/components/task/TaskMeta"
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
import { useMe } from "@/features/auth/useAuth"
import { useAdminUsers, useCreateUser, useResetPassword, useUpdateUser } from "@/features/settings/useAdmin"
import { AVATAR_COLORS, initials, profileLabel } from "@/lib/domain"
import { Field, Panel, SettingsSection } from "./parts"

type Profile = "executor" | "manager" | "admin"

const PROFILES: { value: Profile; title: string; description: string }[] = [
  { value: "executor", title: "Executor", description: "Cria tarefas para si, executa e envia para revisão." },
  { value: "manager", title: "Gestor", description: "Também atribui para qualquer pessoa e aprova ou devolve na revisão." },
  { value: "admin", title: "Administrador", description: "Gestor que também acessa estas Configurações." },
]

const profileOf = (u: { role: string; isAdmin: boolean }): Profile => (u.isAdmin ? "admin" : (u.role as Profile))
const toRole = (p: Profile) => ({ role: p === "executor" ? ("executor" as const) : ("manager" as const), isAdmin: p === "admin" })

export function UsersTab() {
  const users = useAdminUsers()
  const { data: me } = useMe()
  const update = useUpdateUser()
  const reset = useResetPassword()
  const [editing, setEditing] = useState<AdminUserDTO | "new" | null>(null)
  const [password, setPassword] = useState<{ name: string; value: string } | null>(null)

  const active = users.data?.filter((u) => u.isActive) ?? []
  const inactive = users.data?.filter((u) => !u.isActive) ?? []

  return (
    <SettingsSection
      title="Usuários"
      description="Quem acessa o sistema e o que cada pessoa pode fazer. Ao cadastrar ou redefinir a senha, o sistema gera uma senha temporária que aparece uma única vez."
      actions={
        <Button onClick={() => setEditing("new")}>
          <UserPlus /> Novo usuário
        </Button>
      }
    >
      <Panel className="divide-y divide-hairline p-0 sm:p-0">
        {users.isPending && <p className="px-6 py-8 text-sm text-ink-3">Carregando…</p>}
        {[...active, ...inactive].map((u) => (
          <div key={u.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6", !u.isActive && "opacity-55")}>
            <UserAvatar user={u} withTooltip={false} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {u.name}
                {u.id === me?.id && <span className="ml-1.5 font-normal text-ink-3">(você)</span>}
              </p>
              <p className="truncate text-xs text-ink-3">
                {u.email}
                {u.jobTitle && <> · {u.jobTitle}</>}
              </p>
            </div>
            {u.isActive ? (
              <Badge variant={u.isAdmin ? "brand" : "default"}>{profileLabel(u)}</Badge>
            ) : (
              <Badge variant="outline">Desativado</Badge>
            )}
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${u.name}`} onClick={() => setEditing(u)}>
              <Pencil />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Mais ações para ${u.name}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onSelect={() =>
                    reset.mutate(u.id, { onSuccess: ({ temporaryPassword }) => setPassword({ name: u.name, value: temporaryPassword }) })
                  }
                >
                  <KeyRound /> Gerar nova senha
                </DropdownMenuItem>
                {u.id !== me?.id && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant={u.isActive ? "destructive" : "default"}
                      onSelect={() =>
                        update.mutate(
                          { id: u.id, patch: { isActive: !u.isActive } },
                          { onSuccess: () => toast.success(u.isActive ? `${u.name} desativado(a)` : `${u.name} reativado(a)`) }
                        )
                      }
                    >
                      <Power /> {u.isActive ? "Desativar acesso" : "Reativar acesso"}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </Panel>

      <UserDialog
        user={editing}
        me={me}
        onClose={() => setEditing(null)}
        onCreated={(name, value) => setPassword({ name, value })}
      />
      <TemporaryPasswordDialog password={password} onClose={() => setPassword(null)} />
    </SettingsSection>
  )
}

function UserDialog({
  user,
  me,
  onClose,
  onCreated,
}: {
  user: AdminUserDTO | "new" | null
  me?: UserDTO | null
  onClose: () => void
  onCreated: (name: string, password: string) => void
}) {
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      {user && (
        <UserForm key={user === "new" ? "new" : user.id} user={user === "new" ? null : user} me={me} onClose={onClose} onCreated={onCreated} />
      )}
    </Dialog>
  )
}

function UserForm({
  user,
  me,
  onClose,
  onCreated,
}: {
  user: AdminUserDTO | null
  me?: UserDTO | null
  onClose: () => void
  onCreated: (name: string, password: string) => void
}) {
  const create = useCreateUser()
  const update = useUpdateUser()
  const [name, setName] = useState(user?.name ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? "")
  const [profile, setProfile] = useState<Profile>(user ? profileOf(user) : "executor")
  const [color, setColor] = useState<AvatarColor>(user?.avatarColor ?? "teal")
  const isSelf = user?.id === me?.id
  const pending = create.isPending || update.isPending
  const valid = name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    const payload = { name: name.trim(), email: email.trim(), jobTitle: jobTitle.trim() || null, avatarColor: color, ...toRole(profile) }
    if (user) {
      update.mutate(
        { id: user.id, patch: payload },
        {
          onSuccess: () => {
            toast.success("Usuário atualizado")
            onClose()
          },
        }
      )
    } else {
      create.mutate(payload, {
        onSuccess: ({ user: created, temporaryPassword }) => {
          onClose()
          onCreated(created.name, temporaryPassword)
        },
      })
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={submit} className="grid gap-5">
        <DialogHeader>
          <DialogTitle>{user ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          <DialogDescription>
            {user ? "As mudanças de perfil valem a partir da próxima ação da pessoa." : "Uma senha temporária será gerada ao salvar."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="user-name" className="sm:col-span-2">
            <Input id="user-name" autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="E-mail (login)" htmlFor="user-email">
            <Input id="user-email" type="email" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Cargo (opcional)" htmlFor="user-job">
            <Input id="user-job" value={jobTitle} maxLength={60} placeholder="Ex.: Analista de TI" onChange={(e) => setJobTitle(e.target.value)} />
          </Field>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-[13px] font-medium text-ink">Perfil</legend>
          {PROFILES.map((p) => {
            const locked = isSelf && p.value !== "admin"
            return (
              <label
                key={p.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl px-3.5 py-3 transition-colors",
                  profile === p.value ? "bg-brand-50 shadow-[inset_0_0_0_1.5px_var(--brand-300)]" : "bg-surface-sunken hover:bg-[#f1f1f4]",
                  locked && "cursor-not-allowed opacity-50"
                )}
              >
                <input
                  type="radio"
                  name="profile"
                  value={p.value}
                  checked={profile === p.value}
                  disabled={locked}
                  onChange={() => setProfile(p.value)}
                  className="mt-1 accent-(--brand-600)"
                />
                <span>
                  <span className="block text-sm font-medium text-ink">{p.title}</span>
                  <span className="block text-xs text-ink-3">{p.description}</span>
                </span>
              </label>
            )
          })}
          {isSelf && <p className="text-xs text-ink-3">Você não pode tirar o próprio acesso de administrador.</p>}
        </fieldset>

        <Field label="Cor do avatar">
          <div className="flex items-center gap-2">
            {AVATAR_COLOR_KEYS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Cor ${c}`}
                aria-pressed={color === c}
                className={cn(
                  "grid size-9 place-items-center rounded-full text-xs font-semibold transition-transform hover:scale-110",
                  AVATAR_COLORS[c],
                  color === c && "ring-2 ring-ink ring-offset-2 ring-offset-surface"
                )}
              >
                {initials(name || "?")}
              </button>
            ))}
          </div>
        </Field>

        <DialogFooter showCloseButton>
          <Button type="submit" disabled={!valid || pending}>
            {pending ? "Salvando…" : user ? "Salvar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function TemporaryPasswordDialog({ password, onClose }: { password: { name: string; value: string } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password.value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Não deu para copiar. Selecione e copie a senha manualmente.")
    }
  }

  return (
    <Dialog open={password !== null} onOpenChange={(open) => !open && onClose()}>
      {password && (
        <DialogContent>
          <DialogHeader>
            <span className="mb-2 grid size-10 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <KeyRound className="size-5" />
            </span>
            <DialogTitle>Senha de {password.name.split(" ")[0]}</DialogTitle>
            <DialogDescription>
              Anote ou copie agora: esta senha não aparece de novo. Entregue pessoalmente; a pessoa pode trocá-la depois em
              “Alterar senha”, no menu do usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-2xl bg-surface-sunken p-2 pl-4">
            <code className="flex-1 font-mono text-lg tracking-wider text-ink select-all">{password.value}</code>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check /> : <Copy />} {copied ? "Copiada" : "Copiar"}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Pronto</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}
