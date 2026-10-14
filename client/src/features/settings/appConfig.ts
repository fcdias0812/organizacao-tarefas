import { createContext, useContext } from "react"
import { useQuery } from "@tanstack/react-query"
import type { LucideIcon } from "lucide-react"
import {
  DEFAULT_SETTINGS,
  type CategoryDTO,
  type CategoryKey,
  type RuleOptions,
  type SettingsDTO,
  type TaskPriority,
  type TaskStatus,
} from "@tarefas/shared"

import { api } from "@/lib/api"
import { categoryIcon } from "@/lib/categoryIcons"
import { queryKeys } from "@/lib/queryClient"

export interface CategoryMeta {
  key: CategoryKey
  label: string
  Icon: LucideIcon
  isActive: boolean
}

/** Configurações do sistema já prontas para as telas usarem. */
export interface AppConfig {
  settings: SettingsDTO
  categories: CategoryDTO[]
  /** Só as ativas, na ordem definida: para escolher em formulários e filtros. */
  activeCategories: CategoryDTO[]
  statusLabel: (status: TaskStatus) => string
  priority: (priority: TaskPriority) => { label: string; color: string }
  category: (key: CategoryKey) => CategoryMeta
  ruleOptions: RuleOptions
}

export function buildAppConfig(settings: SettingsDTO, categories: CategoryDTO[]): AppConfig {
  const byKey = new Map(categories.map((c) => [c.key, c]))
  return {
    settings,
    categories,
    activeCategories: categories.filter((c) => c.isActive),
    statusLabel: (status) => settings.statusLabels[status],
    priority: (p) => settings.priorities[p],
    category: (key) => {
      const c = byKey.get(key)
      return { key, label: c?.name ?? key, Icon: categoryIcon(c?.icon ?? "tag"), isActive: c?.isActive ?? false }
    },
    ruleOptions: { statusLabels: settings.statusLabels, reasonMinLength: settings.reasonMinLength },
  }
}

export const AppConfigContext = createContext<AppConfig>(buildAppConfig(DEFAULT_SETTINGS, []))

export function useAppConfig(): AppConfig {
  return useContext(AppConfigContext)
}

export function useSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: async () => (await api<{ settings: SettingsDTO }>("GET", "/settings")).settings,
    staleTime: 5 * 60_000,
  })
}

export function useCategoriesQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => (await api<{ categories: CategoryDTO[] }>("GET", "/categories")).categories,
    staleTime: 5 * 60_000,
    enabled,
  })
}
