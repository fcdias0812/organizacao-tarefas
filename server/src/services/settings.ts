import { mergeSettings, TASK_PRIORITIES, type RuleOptions, type SettingsDTO, type SettingsInput } from "@tarefas/shared"

import type { Db } from "../db/connection"

const KEY = "app"

export function getSettings(db: Db): SettingsDTO {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(KEY) as { value: string } | undefined
  return mergeSettings(row ? (JSON.parse(row.value) as Partial<SettingsDTO>) : null)
}

/** Opções das regras de qualidade que dependem das configurações. */
export function ruleOptions(db: Db): RuleOptions {
  const { statusLabels, reasonMinLength } = getSettings(db)
  return { statusLabels, reasonMinLength }
}

export function updateSettings(db: Db, patch: SettingsInput): SettingsDTO {
  const current = getSettings(db)
  const priorities = { ...current.priorities }
  for (const key of TASK_PRIORITIES) priorities[key] = { ...current.priorities[key], ...patch.priorities?.[key] }
  for (const key of TASK_PRIORITIES) priorities[key].color = priorities[key].color.toLowerCase()
  const next = mergeSettings({
    ...current,
    ...patch,
    statusLabels: { ...current.statusLabels, ...patch.statusLabels },
    priorities,
    brandColor: (patch.brandColor ?? current.brandColor).toLowerCase(),
  })
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(KEY, JSON.stringify(next), new Date().toISOString())
  return next
}
