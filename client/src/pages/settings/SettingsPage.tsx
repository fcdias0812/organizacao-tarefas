import { lazy, Suspense } from "react"
import { ArrowLeft, Clock, Columns3, Flag, Palette, Sparkles, Tags, Users, type LucideIcon } from "lucide-react"
import { Link, Navigate, NavLink, useParams } from "react-router"
import { cn } from "cn"

import { TopBar } from "@/components/layout/TopBar"
import { useMe } from "@/features/auth/useAuth"
import { useBoard } from "@/features/board/useBoardData"
import { useSettingsQuery } from "@/features/settings/appConfig"
import { CategoriesTab } from "./CategoriesTab"
import { ColumnsTab, IdentityTab, PrioritiesTab, RulesTab } from "./GeneralTabs"
import { UsersTab } from "./UsersTab"

const DesignSystemPage = lazy(() =>
  import("@/pages/design-system/DesignSystemPage").then((m) => ({ default: m.DesignSystemPage }))
)

const TABS: { slug: string; label: string; icon: LucideIcon; render: () => React.ReactNode }[] = [
  { slug: "usuarios", label: "Usuários", icon: Users, render: () => <UsersTab /> },
  { slug: "categorias", label: "Categorias", icon: Tags, render: () => <CategoriesTab /> },
  { slug: "colunas", label: "Colunas", icon: Columns3, render: () => <ColumnsTab /> },
  { slug: "prioridades", label: "Prioridades", icon: Flag, render: () => <PrioritiesTab /> },
  { slug: "prazos", label: "Prazos e regras", icon: Clock, render: () => <RulesTab /> },
  { slug: "identidade", label: "Identidade", icon: Sparkles, render: () => <IdentityTab /> },
  {
    slug: "design-system",
    label: "Design system",
    icon: Palette,
    render: () => (
      <Suspense fallback={<p className="text-sm text-ink-3">Carregando…</p>}>
        <DesignSystemPage />
      </Suspense>
    ),
  },
]

/** Configurações (só administrador): tudo que o sistema deixa personalizar. */
export function SettingsPage() {
  const { data: me } = useMe()
  const { aba } = useParams()
  const board = useBoard()
  const settings = useSettingsQuery()

  if (!me?.isAdmin) return <Navigate to="/" replace />
  const tab = TABS.find((t) => t.slug === aba)
  if (!tab) return <Navigate to={`/configuracoes/${TABS[0].slug}`} replace />

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="sticky top-0 z-30 bg-canvas/85 backdrop-blur-md">
        <TopBar team={board.users} />
      </div>

      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 pb-24 sm:px-6 lg:flex-row lg:gap-12">
        <aside className="shrink-0 lg:sticky lg:top-20 lg:h-fit lg:w-56">
          <Link
            to="/"
            className="mb-5 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-medium text-ink-3 transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <ArrowLeft className="size-4" /> Voltar ao quadro
          </Link>
          <h1 className="mb-4 px-2 text-2xl font-semibold tracking-tight text-ink">Configurações</h1>
          <nav aria-label="Seções das configurações" className="scroll-soft -mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
            <ul className="flex gap-1 lg:flex-col">
              {TABS.map(({ slug, label, icon: Icon }) => (
                <li key={slug} className="shrink-0">
                  <NavLink
                    to={`/configuracoes/${slug}`}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                        isActive ? "bg-brand-50 text-brand-700" : "text-ink-2 hover:bg-surface-sunken hover:text-ink"
                      )
                    }
                  >
                    <Icon className="size-4" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 pt-1 lg:pt-12">
          {/* Os formulários partem das configurações salvas: espera carregarem. */}
          {settings.isSuccess ? (
            <div key={tab.slug} className="animate-pop-in">
              {tab.render()}
            </div>
          ) : (
            <p className="text-sm text-ink-3">Carregando…</p>
          )}
        </main>
      </div>
    </div>
  )
}
