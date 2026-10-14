import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type {
  AdminUserDTO,
  CategoryDTO,
  CreateCategoryInput,
  CreateUserInput,
  SettingsDTO,
  SettingsInput,
  UpdateCategoryInput,
  UpdateUserInput,
} from "@tarefas/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/queryClient"

const showError = (error: Error) => toast.error(error.message)

/* ───────────────────────── usuários ───────────────────────── */

export function useAdminUsers() {
  return useQuery({
    queryKey: queryKeys.adminUsers,
    queryFn: async () => (await api<{ users: AdminUserDTO[] }>("GET", "/admin/users")).users,
  })
}

function useRefreshUsers() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers })
    void queryClient.invalidateQueries({ queryKey: queryKeys.users })
    void queryClient.invalidateQueries({ queryKey: queryKeys.me })
  }
}

export function useCreateUser() {
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: (input: Partial<CreateUserInput> & Pick<CreateUserInput, "name" | "email" | "role">) =>
      api<{ user: AdminUserDTO; temporaryPassword: string }>("POST", "/admin/users", input),
    onSuccess: refresh,
    onError: showError,
  })
}

export function useUpdateUser() {
  const refresh = useRefreshUsers()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: UpdateUserInput }) =>
      api<{ user: AdminUserDTO }>("PATCH", `/admin/users/${id}`, patch),
    onSuccess: refresh,
    onError: showError,
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (id: number) => api<{ temporaryPassword: string }>("POST", `/admin/users/${id}/reset-password`),
    onError: showError,
  })
}

/* ───────────────────────── categorias ───────────────────────── */

export function useAdminCategories() {
  return useQuery({
    queryKey: queryKeys.adminCategories,
    queryFn: async () => (await api<{ categories: CategoryDTO[] }>("GET", "/admin/categories")).categories,
  })
}

function useRefreshCategories() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories })
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories })
  }
}

export function useCreateCategory() {
  const refresh = useRefreshCategories()
  return useMutation({
    mutationFn: (input: CreateCategoryInput) => api<{ category: CategoryDTO }>("POST", "/admin/categories", input),
    onSuccess: refresh,
    onError: showError,
  })
}

export function useUpdateCategory() {
  const refresh = useRefreshCategories()
  return useMutation({
    mutationFn: ({ key, patch }: { key: string; patch: UpdateCategoryInput }) =>
      api<{ category: CategoryDTO }>("PATCH", `/admin/categories/${encodeURIComponent(key)}`, patch),
    onSuccess: refresh,
    onError: showError,
  })
}

export function useDeleteCategory() {
  const refresh = useRefreshCategories()
  return useMutation({
    mutationFn: (key: string) => api<void>("DELETE", `/admin/categories/${encodeURIComponent(key)}`),
    onSuccess: refresh,
    onError: showError,
  })
}

export function useReorderCategories() {
  const refresh = useRefreshCategories()
  return useMutation({
    mutationFn: (keys: string[]) => api<{ categories: CategoryDTO[] }>("PUT", "/admin/categories/order", { keys }),
    onSettled: refresh,
    onError: showError,
  })
}

/* ───────────────────────── configurações gerais ───────────────────────── */

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: SettingsInput) => api<{ settings: SettingsDTO }>("PATCH", "/admin/settings", patch),
    onSuccess: ({ settings }) => {
      queryClient.setQueryData(queryKeys.settings, settings)
      toast.success("Configurações salvas")
    },
    onError: showError,
  })
}
