import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { LoginInput, UserDTO } from "@tarefas/shared"

import { api, isUnauthenticated } from "@/lib/api"
import { queryKeys } from "@/lib/queryClient"

/** Usuário logado; `null` quando não há sessão. */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async (): Promise<UserDTO | null> => {
      try {
        return (await api<{ user: UserDTO }>("GET", "/auth/me")).user
      } catch (error) {
        if (isUnauthenticated(error)) return null
        throw error
      }
    },
    staleTime: Infinity,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LoginInput) => api<{ user: UserDTO }>("POST", "/auth/login", input),
    onSuccess: ({ user }) => {
      queryClient.clear()
      queryClient.setQueryData(queryKeys.me, user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>("POST", "/auth/logout"),
    onSettled: () => {
      queryClient.clear()
      queryClient.setQueryData(queryKeys.me, null)
    },
  })
}
