import { QueryCache, QueryClient } from "@tanstack/react-query"

import { isUnauthenticated } from "./api"

export const queryKeys = {
  me: ["me"] as const,
  users: ["users"] as const,
  categories: ["categories"] as const,
  settings: ["settings"] as const,
  adminUsers: ["admin", "users"] as const,
  adminCategories: ["admin", "categories"] as const,
  tasks: ["tasks"] as const,
  task: (id: number) => ["task", id] as const,
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // Sessão expirou em qualquer chamada: esquece o usuário e o guard leva ao login.
    onError: (error, query) => {
      if (isUnauthenticated(error) && query.queryKey[0] !== queryKeys.me[0]) {
        queryClient.setQueryData(queryKeys.me, null)
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !isUnauthenticated(error) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
})
