import { Navigate, Outlet, useLocation } from "react-router"

import { AppLogo } from "@/components/AppLogo"
import { useMe } from "./useAuth"

/** Só deixa passar com sessão válida; senão leva ao login lembrando de onde veio. */
export function RequireAuth() {
  const me = useMe()
  const location = useLocation()

  if (me.isPending) return <FullScreenLoader />
  if (!me.data) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}

/** Na tela de login: quem já está logado vai direto para o quadro. */
export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const me = useMe()
  if (me.isPending) return <FullScreenLoader />
  if (me.data) return <Navigate to="/" replace />
  return children
}

function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <AppLogo showName={false} className="animate-pulse" />
    </div>
  )
}
