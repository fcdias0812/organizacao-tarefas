import { useEffect, useMemo } from "react"
import { DEFAULT_SETTINGS } from "@tarefas/shared"

import { useMe } from "@/features/auth/useAuth"
import { AppConfigContext, buildAppConfig, useCategoriesQuery, useSettingsQuery } from "./appConfig"

function faviconFor(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="${color}"/><rect x="7" y="7" width="8" height="18" rx="2.5" fill="#fff" fill-opacity=".55"/><rect x="17" y="7" width="8" height="12" rx="2.5" fill="#fff"/></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** Carrega as configurações e as categorias e aplica nome, cor e ícone da aba. */
export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const me = useMe()
  const settings = useSettingsQuery().data ?? DEFAULT_SETTINGS
  const categories = useCategoriesQuery(Boolean(me.data)).data
  const value = useMemo(() => buildAppConfig(settings, categories ?? []), [settings, categories])

  // Sincroniza a cor principal, o título e o ícone da aba com as configurações.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty("--brand-600", settings.brandColor)
    document.title = settings.appName
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", settings.brandColor)
    document.querySelector('link[rel="icon"]')?.setAttribute("href", faviconFor(settings.brandColor))
  }, [settings.brandColor, settings.appName])

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>
}
