import type { Meal } from './meals'
import { dayGroups } from './micros'

export type TimedSlot = 'breakfast' | 'lunch' | 'dinner'
const TIMED: TimedSlot[] = ['breakfast', 'lunch', 'dinner']

export interface MealPatterns {
  /** The dates looked at, oldest first, ending on the chosen day. */
  window: string[]
  /** Days in the window with anything logged; every count below is out of this. */
  logged: number
  breakfast: number | null
  /** Latest minus earliest time per meal, in minutes; null when logged on fewer than 2 days. */
  spread: Record<TimedSlot, number | null>
  fruitDays: number | null
  vegDays: number | null
  extrasPerDay: number | null
}

/** The date `n` days after `date` ("YYYY-MM-DD"). */
export function shiftDate(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Eating patterns over the `days` days ending on `end` (inclusive). */
export function mealPatterns(meals: Meal[], end: string, days = 7): MealPatterns {
  const window = Array.from({ length: days }, (_, i) => shiftDate(end, i - days + 1))
  const inWindow = new Set(window)
  const byDay = new Map<string, Meal[]>()
  for (const m of meals)
    if (inWindow.has(m.date) && m.items.length) byDay.set(m.date, [...(byDay.get(m.date) ?? []), m])
  const logged = byDay.size
  const spread = {} as MealPatterns['spread']
  for (const slot of TIMED) {
    const times = [...byDay.values()]
      .map((ms) => ms.find((m) => m.slot === slot)?.time)
      .filter((t): t is string => !!t)
      .map(minutes)
    spread[slot] = times.length < 2 ? null : Math.max(...times) - Math.min(...times)
  }
  if (!logged)
    return {
      window,
      logged,
      breakfast: null,
      spread,
      fruitDays: null,
      vegDays: null,
      extrasPerDay: null,
    }
  const days_ = [...byDay.values()]
  const groups = days_.map(dayGroups)
  const extras = days_.reduce((a, ms) => a + ms.filter((m) => m.slot === 'extra').length, 0)
  return {
    window,
    logged,
    breakfast: days_.filter((ms) => ms.some((m) => m.slot === 'breakfast')).length,
    spread,
    fruitDays: groups.filter((g) => g.has('fruit')).length,
    vegDays: groups.filter((g) => g.has('veg')).length,
    extrasPerDay: Math.round((extras / logged) * 10) / 10,
  }
}

/** "45 min", "2 h 10 min", "3 h". */
export function fmtSpread(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}
