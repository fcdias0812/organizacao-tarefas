import { useState } from "react"
import { Eye, EyeOff, LogIn, TriangleAlert } from "lucide-react"
import { useLocation, useNavigate } from "react-router"
import { cn } from "cn"

import { AppLogo } from "@/components/AppLogo"
import { LoginShowcase } from "@/components/auth/LoginShowcase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLogin } from "@/features/auth/useAuth"

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)

  const from = (location.state as { from?: string } | null)?.from ?? "/"

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    login.mutate(
      { email, password },
      {
        onSuccess: () => navigate(from, { replace: true }),
        onError: () => setShakeKey((k) => k + 1),
      }
    )
  }

  return (
    <div className="grid min-h-dvh bg-canvas lg:h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <main className="flex flex-col px-6 py-8 sm:px-12 lg:overflow-y-auto 2xl:px-16">
        <AppLogo />

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12 2xl:max-w-md">
          <div className="mb-8 space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-ink 2xl:text-4xl">Bem-vindo de volta</h1>
            <p className="text-[15px] text-ink-2 2xl:text-base">Entre para ver o quadro do TI.</p>
          </div>

          <form onSubmit={submit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                placeholder="voce@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={login.isError || undefined}
                className="h-11 2xl:h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={login.isError || undefined}
                  className="h-11 pr-12 2xl:h-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-1.5 -translate-y-1/2"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>

            {login.error && (
              <div
                key={shakeKey}
                role="alert"
                className="flex animate-shake items-start gap-2.5 rounded-2xl bg-danger-soft px-4 py-3 text-[13px] text-danger"
              >
                <TriangleAlert className="mt-px size-4 shrink-0" />
                {login.error.message}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className={cn("w-full", login.isPending && "pointer-events-none")}
              aria-busy={login.isPending}
              disabled={!email.trim() || !password}
            >
              {login.isPending ? (
                <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <LogIn />
              )}
              Entrar
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-ink-3">Esqueceu a senha? Fale com o gestor do TI.</p>
        </div>
      </main>

      <LoginShowcase />
    </div>
  )
}
