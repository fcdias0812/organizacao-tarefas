import type { TaskPriority, TaskStatus } from "./types"

/** Tudo que o administrador personaliza em Configurações (exceto usuários e categorias). */
export interface SettingsDTO {
  /** Nome exibido no topo, no login e na aba do navegador. */
  appName: string
  /** Cor principal (hex). As variações claras e escuras são derivadas dela. */
  brandColor: string
  /** Quantos dias antes do prazo o card fica âmbar ("vence em breve"). */
  soonDays: number
  /** Tamanho mínimo do motivo de bloqueio e de devolução. */
  reasonMinLength: number
  statusLabels: Record<TaskStatus, string>
  priorities: Record<TaskPriority, { label: string; color: string }>
}

export const DEFAULT_SETTINGS: SettingsDTO = {
  appName: "Tarefas TI",
  brandColor: "#7c3aed",
  soonDays: 2,
  reasonMinLength: 3,
  statusLabels: {
    todo: "A fazer",
    in_progress: "Em andamento",
    review: "Revisão",
    done: "Concluído",
    blocked: "Bloqueado",
  },
  priorities: {
    urgent: { label: "Urgente", color: "#f0565b" },
    high: { label: "Alta", color: "#f59e4c" },
    medium: { label: "Média", color: "#f2c94c" },
    low: { label: "Baixa", color: "#c4c4cb" },
  },
}

/** Junta o que está salvo com os padrões (campos novos ganham o valor padrão). */
export function mergeSettings(saved: Partial<SettingsDTO> | null | undefined): SettingsDTO {
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    statusLabels: { ...DEFAULT_SETTINGS.statusLabels, ...saved?.statusLabels },
    priorities: {
      urgent: { ...DEFAULT_SETTINGS.priorities.urgent, ...saved?.priorities?.urgent },
      high: { ...DEFAULT_SETTINGS.priorities.high, ...saved?.priorities?.high },
      medium: { ...DEFAULT_SETTINGS.priorities.medium, ...saved?.priorities?.medium },
      low: { ...DEFAULT_SETTINGS.priorities.low, ...saved?.priorities?.low },
    },
  }
}

/** Ícones que o administrador pode escolher para uma categoria (nomes do lucide). */
export const CATEGORY_ICONS = [
  "headset",
  "server",
  "shopping-cart",
  "folder-kanban",
  "refresh-cw",
  "tag",
  "wrench",
  "shield",
  "network",
  "printer",
  "monitor",
  "laptop",
  "smartphone",
  "database",
  "cloud",
  "mail",
  "phone",
  "wifi",
  "hard-drive",
  "key-round",
  "users",
  "file-text",
  "bug",
  "rocket",
  "package",
  "cpu",
  "router",
  "camera",
  "globe",
  "code",
] as const
export type CategoryIcon = (typeof CATEGORY_ICONS)[number]
