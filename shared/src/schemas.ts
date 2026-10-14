import { z } from "zod"

import { REASON_MAX_LENGTH } from "./rules"
import { CATEGORY_KEYS, TASK_PRIORITIES, TASK_STATUSES } from "./types"

const title = z
  .string()
  .trim()
  .min(1, "Informe um título.")
  .max(200, "O título pode ter no máximo 200 caracteres.")

const dueDate = z.iso.date("Prazo inválido. Use o formato AAAA-MM-DD.").nullable()
const userId = z.number().int().positive()

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Informe o e-mail."),
  password: z.string().min(1, "Informe a senha."),
})

export const createTaskSchema = z.object({
  title,
  description: z.string().max(5000).optional().default(""),
  category: z.enum(CATEGORY_KEYS),
  priority: z.enum(TASK_PRIORITIES).optional().default("medium"),
  dueDate: dueDate.optional().default(null),
  /** Omitido = quem está criando. */
  assigneeId: userId.nullable().optional(),
})

export const updateTaskSchema = z
  .object({
    title,
    description: z.string().max(5000),
    category: z.enum(CATEGORY_KEYS),
    priority: z.enum(TASK_PRIORITIES),
    dueDate,
    assigneeId: userId.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nada para atualizar.")

export const moveTaskSchema = z.object({
  status: z.enum(TASK_STATUSES),
  /** Posição desejada na coluna de destino (0 = topo). Omitido = fim da coluna. */
  index: z.number().int().min(0).optional(),
  reason: z.string().trim().max(REASON_MAX_LENGTH).optional(),
})

export const createChecklistItemSchema = z.object({
  label: z.string().trim().min(1, "Descreva o item.").max(200),
})

export const updateChecklistItemSchema = z
  .object({
    label: z.string().trim().min(1, "Descreva o item.").max(200),
    isDone: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nada para atualizar.")

export type LoginInput = z.infer<typeof loginSchema>
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type MoveTaskInput = z.infer<typeof moveTaskSchema>
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>
