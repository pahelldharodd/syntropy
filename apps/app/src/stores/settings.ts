'use client'

import { today } from '@/lib/dates'
import { DEFAULT_MODELS, type Models, upgradeModels } from '@/lib/models'
import type { MealTimes } from '@/platform/notifications'
import { persisted } from './persist'

export { DEFAULT_MODELS }

type SettingsStore = {
  models: Models
  dailyCap: number
  usage: { date: string; count: number }
  aiConsent: boolean
  hasKey: boolean
  restSec: number
  mealReminders: boolean
  mealTimes: MealTimes
  set: (p: Partial<Omit<SettingsStore, 'set' | 'countUse' | 'remaining'>>) => void
  countUse: () => void
  remaining: () => number
}

export const useSettings = persisted<SettingsStore>(
  'settings',
  (set, get) => ({
    models: DEFAULT_MODELS,
    dailyCap: 60,
    usage: { date: today(), count: 0 },
    aiConsent: false,
    hasKey: false,
    restSec: 90,
    mealReminders: false,
    mealTimes: { breakfast: '08:30', lunch: '13:00', dinner: '20:00' },
    set: (p) => set(p),
    countUse: () => {
      const u = get().usage
      set({
        usage:
          u.date === today() ? { date: u.date, count: u.count + 1 } : { date: today(), count: 1 },
      })
    },
    remaining: () => {
      const u = get().usage
      return get().dailyCap - (u.date === today() ? u.count : 0)
    },
  }),
  // v2: the photo-scan default moved off gemini-3.8-flash, which kept timing out.
  2,
  (s, v) => {
    const old = s as SettingsStore
    return (v < 2 ? { ...old, models: upgradeModels(old.models) } : old) as SettingsStore
  },
)
