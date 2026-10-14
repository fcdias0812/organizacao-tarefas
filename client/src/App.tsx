import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router"

import { RedirectIfAuthenticated, RequireAuth } from "@/features/auth/RequireAuth"
import { BoardPage } from "@/pages/BoardPage"
import { LoginPage } from "@/pages/LoginPage"

// Páginas fora do quadro (Configurações só o administrador usa): ficam fora do pacote principal.
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })))
const AuditPage = lazy(() => import("@/pages/AuditPage").then((m) => ({ default: m.AuditPage })))

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        }
      />
      <Route element={<RequireAuth />}>
        <Route index element={<BoardPage />} />
        <Route
          path="auditoria"
          element={
            <Suspense fallback={null}>
              <AuditPage />
            </Suspense>
          }
        />
        <Route
          path="configuracoes/:aba?"
          element={
            <Suspense fallback={null}>
              <SettingsPage />
            </Suspense>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
