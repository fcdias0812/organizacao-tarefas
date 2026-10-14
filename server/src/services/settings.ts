import { mergeSettings, TASK_PRIORITIES, type RuleOptions, type SettingsDTO, type SettingsInput } from "@tarefas/shared"

import type { Db } from "../db/connection"

const KEY = "app"

export async function getSettings(db: Db): Promise<SettingsDTO> {
  const row = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = ?", KEY)
  return mergeSettings(row ? (JSON.parse(row.value) as Partial<SettingsDTO>) : null)
}

/** Opções das regras de qualidade que dependem das configurações. */
export async function ruleOptions(db: Db): Promise<RuleOptions> {
  const { statusLabels, reasonMinLength } = await getSettings(db)
  return { statusLabels, reasonMinLength }
}

export async function updateSettings(db: Db, patch: SettingsInput): Promise<SettingsDTO> {
  const current = await getSettings(db)
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
  await db.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    KEY,
    JSON.stringify(next),
    new Date().toISOString()
  )
  return next
}
