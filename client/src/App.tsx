import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router"

import { RedirectIfAuthenticated, RequireAuth } from "@/features/auth/RequireAuth"
import { BoardPage } from "@/pages/BoardPage"
import { LoginPage } from "@/pages/LoginPage"

// Vitrine do design system: só existe em desenvolvimento e é carregada sob demanda.
const DesignSystemPage = import.meta.env.DEV
  ? lazy(() => import("@/pages/design-system/DesignSystemPage").then((m) => ({ default: m.DesignSystemPage })))
  : () => null

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
      </Route>
      {/* Vitrine do design system: só no ambiente de desenvolvimento. */}
      {import.meta.env.DEV && (
        <Route
          path="/design-system"
          element={
            <Suspense fallback={null}>
              <DesignSystemPage />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
