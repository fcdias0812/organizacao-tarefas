import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router"

import { RedirectIfAuthenticated, RequireAuth } from "@/features/auth/RequireAuth"
import { BoardPage } from "@/pages/BoardPage"
import { LoginPage } from "@/pages/LoginPage"

// Configurações: só o administrador usa, então fica fora do pacote principal.
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })))

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
