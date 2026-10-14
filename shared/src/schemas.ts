import { z } from "zod"

import { REASON_MAX_LENGTH } from "./rules"
import { CATEGORY_ICONS } from "./settings"
import { AVATAR_COLORS, TASK_PRIORITIES, TASK_STATUSES, USER_ROLES } from "./types"

const title = z
  .string()
  .trim()
  .min(1, "Informe um título.")
  .max(200, "O título pode ter no máximo 200 caracteres.")

const dueDate = z.iso.date("Prazo inválido. Use o formato AAAA-MM-DD.").nullable()
const userId = z.number().int().positive()
const categoryKey = z.string().trim().min(1, "Escolha uma categoria.").max(40)
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #RRGGBB.")

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Informe o e-mail."),
  password: z.string().min(1, "Informe a senha."),
})

export const PASSWORD_MIN_LENGTH = 8

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `A nova senha precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
    .max(200),
})

export const createTaskSchema = z.object({
  title,
  description: z.string().max(5000).optional().default(""),
  category: categoryKey,
  priority: z.enum(TASK_PRIORITIES).optional().default("medium"),
  dueDate: dueDate.optional().default(null),
  /** Omitido = quem está criando. */
  assigneeId: userId.nullable().optional(),
})

export const updateTaskSchema = z
  .object({
    title,
    description: z.string().max(5000),
    category: categoryKey,
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

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Escreva o comentário.").max(2000, "O comentário pode ter no máximo 2000 caracteres."),
})

/* ───────────────────────── administração ───────────────────────── */

const userFields = {
  name: z.string().trim().min(2, "Informe o nome.").max(80),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(120),
  role: z.enum(USER_ROLES),
  isAdmin: z.boolean(),
  jobTitle: z.string().trim().max(60).nullable(),
  avatarColor: z.enum(AVATAR_COLORS),
}

export const createUserSchema = z.object(userFields).extend({
  jobTitle: userFields.jobTitle.optional().default(null),
  isAdmin: userFields.isAdmin.optional().default(false),
  avatarColor: userFields.avatarColor.optional(),
})

export const updateUserSchema = z
  .object({ ...userFields, isActive: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nada para atualizar.")

const templateItems = z
  .array(z.string().trim().min(1, "Item do checklist vazio.").max(200))
  .max(30, "Use no máximo 30 itens no checklist padrão.")

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da categoria.").max(40),
  icon: z.enum(CATEGORY_ICONS),
  checklistTemplate: templateItems.optional().default([]),
})

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome da categoria.").max(40),
    icon: z.enum(CATEGORY_ICONS),
    isActive: z.boolean(),
    checklistTemplate: templateItems,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nada para atualizar.")

export const reorderCategoriesSchema = z.object({
  keys: z.array(categoryKey).min(1),
})

const label = (what: string) => z.string().trim().min(1, `Informe o nome ${what}.`).max(30)
const priority = z.object({ label: label("da prioridade"), color: hexColor }).partial()

export const settingsSchema = z
  .object({
    appName: z.string().trim().min(2, "Informe o nome do sistema.").max(40),
    brandColor: hexColor,
    soonDays: z.number().int().min(0).max(30),
    reasonMinLength: z.number().int().min(1).max(100),
    statusLabels: z
      .object({
        todo: label("da coluna"),
        in_progress: label("da coluna"),
        review: label("da coluna"),
        done: label("da coluna"),
        blocked: label("da coluna"),
      })
      .partial(),
    priorities: z
      .object({
        urgent: priority,
        high: priority,
        medium: priority,
        low: priority,
      })
      .partial(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nada para atualizar.")

export type LoginInput = z.infer<typeof loginSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type MoveTaskInput = z.infer<typeof moveTaskSchema>
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>
export type CommentInput = z.infer<typeof commentSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type SettingsInput = z.infer<typeof settingsSchema>
