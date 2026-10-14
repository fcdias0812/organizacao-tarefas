import { useState } from "react"
import { ChevronDown, KeyRound, LogOut, ScrollText, Settings } from "lucide-react"
import { Link, useNavigate } from "react-router"
import type { UserDTO } from "@tarefas/shared"

import { AppLogo } from "@/components/AppLogo"
import { UserAvatar } from "@/components/task/TaskMeta"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLogout, useMe } from "@/features/auth/useAuth"
import { profileLabel } from "@/lib/domain"
import { ChangePasswordDialog } from "./ChangePasswordDialog"

export function TopBar({ team }: { team: UserDTO[] }) {
  const { data: me } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  const [passwordOpen, setPasswordOpen] = useState(false)

  if (!me) return null

  return (
    <header className="flex h-16 shrink-0 short:h-14 items-center gap-4 px-4 sm:px-6">
      <Link to="/" className="rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
        <AppLogo />
      </Link>

      <div className="ml-auto flex items-center gap-3">
        {team.length > 0 && (
          <div className="hidden -space-x-1.5 sm:flex" aria-label="Equipe">
            {team.map((u) => (
              <UserAvatar key={u.id} user={u} size="sm" />
            ))}
          </div>
        )}
        <span className="hidden h-5 w-px bg-hairline sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pr-2.5 pl-1 text-sm font-medium text-ink outline-none transition-colors hover:bg-surface-sunken focus-visible:ring-4 focus-visible:ring-brand-100 aria-expanded:bg-surface-sunken">
            <UserAvatar user={me} size="sm" withTooltip={false} />
            <span className="hidden sm:inline">{me.name.split(" ")[0]}</span>
            <ChevronDown className="size-3.5 text-ink-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="flex items-center gap-3 px-2.5 py-2">
              <UserAvatar user={me} withTooltip={false} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{me.name}</p>
                <p className="truncate text-xs text-ink-3">
                  {me.jobTitle ? `${me.jobTitle} · ` : ""}
                  {profileLabel(me)}
                </p>
              </div>
            </div>
            <DropdownMenuSeparator />
            {me.isAdmin && (
              <DropdownMenuItem onSelect={() => navigate("/configuracoes")}>
                <Settings /> Configurações
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => navigate("/auditoria")}>
              <ScrollText /> Auditoria
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPasswordOpen(true)}>
              <KeyRound /> Alterar senha
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => logout.mutate(undefined, { onSettled: () => navigate("/login") })}>
              <LogOut /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </header>
  )
}
