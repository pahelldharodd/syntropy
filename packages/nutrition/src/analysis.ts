import type { Food } from './foods'
import { dayTotals, type Macros, type Meal, macroSplit } from './meals'
import {
  dayMicros,
  FOOD_GROUPS,
  type FoodGroup,
  foodGroups,
  itemFood,
  MICRO_KEYS,
  type Micros,
} from './micros'
import { fmtSpread, mealPatterns, shiftDate, type TimedSlot } from './patterns'

/*
 * Dietary pattern analysis over a 7-day food log, for the study objectives:
 * food-group frequency and variety, meal and snack frequency and timing, dietary diversity,
 * energy and nutrient intake, and one of the four rule-based patterns used in the survey.
 */

/** Packaged and fast foods in the table (the survey's "packaged food"). */
export const PROCESSED_IDS = new Set([
  'maggi',
  'namkeen',
  'potato-chips',
  'tortilla-chips',
  'crackers',
  'pretzels',
  'granola-bar',
  'ketchup',
  'milk-chocolate',
  'choc-chip-cookie',
  'donut',
  'brownie',
  'cheesecake',
  'ice-cream',
  'jam',
  'cola',
  'energy-drink',
  'sports-drink',
  'cornflakes',
  'white-bread',
  'mayonnaise',
])

export const isProcessed = (food: Food) =>
  food.category === 'fastfood' || PROCESSED_IDS.has(food.id)

const TIMED: TimedSlot[] = ['breakfast', 'lunch', 'dinner']
/** Dinner after 21:30 counts as late. */
const LATE_DINNER = 21 * 60 + 30
/** A main meal whose time moves by 2 h or more across the week is irregular. */
const IRREGULAR_SPREAD = 120

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export interface DayRow {
  date: string
  logged: boolean
  /** Breakfast, lunch and dinner eaten (0–3). */
  mains: number
  /** Snack-slot meals plus extras. */
  snacks: number
  times: Record<TimedSlot, string | null>
  macros: Macros
  micros: Micros
  groups: Record<FoodGroup, boolean>
  /** Food groups eaten that day, 0–5. */
  diversity: number
  /** Any packaged or fast food. */
  processed: boolean
}

/** One day of the log, summarised. */
export function dayRow(meals: Meal[], date: string): DayRow {
  const day = meals.filter((m) => m.date === date && m.items.length)
  const times = {} as DayRow['times']
  for (const s of TIMED)
    times[s] =
      day
        .filter((m) => m.slot === s)
        .map((m) => m.time)
        .sort()[0] ?? null
  const eaten = new Set<FoodGroup>()
  let processed = false
  for (const m of day)
    for (const it of m.items) {
      const food = itemFood(it)
      if (!food) continue
      for (const g of foodGroups(food)) eaten.add(g)
      if (isProcessed(food)) processed = true
    }
  return {
    date,
    logged: day.length > 0,
    mains: TIMED.filter((s) => times[s]).length,
    snacks: day.filter((m) => m.slot === 'snack' || m.slot === 'extra').length,
    times,
    macros: dayTotals(day),
    micros: dayMicros(day).total,
    groups: Object.fromEntries(FOOD_GROUPS.map((g) => [g, eaten.has(g)])) as DayRow['groups'],
    diversity: eaten.size,
    processed,
  }
}

export type PatternId = 'processed' | 'fruit-veg' | 'irregular' | 'mixed'

/** The four survey patterns, in the order their rules are applied. */
export const DIET_PATTERNS: Record<PatternId, { name: string; rule: string }> = {
  processed: {
    name: 'Processed-food dominant',
    rule: 'Packaged or fast food on 5 or more days a week',
  },
  'fruit-veg': {
    name: 'Fruit and veg rich',
    rule: 'Fruit and vegetables on 5 or more days, packaged food on 2 or fewer',
  },
  irregular: {
    name: 'Irregular or meal-skipping',
    rule: 'Breakfast missed on 3 or more days, or a meal time that moves by 2 h or more',
  },
  mixed: { name: 'Mixed or moderate', rule: 'Everyone else' },
}

export interface DietPattern {
  id: PatternId
  name: string
  /** The evidence that placed the week in this pattern. */
  reasons: string[]
}

export interface WeekAnalysis {
  window: string[]
  logged: number
  /** Every day of the window, oldest first; check `logged`. */
  rows: DayRow[]
  timing: {
    breakfastMissed: number
    spread: Record<TimedSlot, number | null>
    lateDinners: number
    mainsPerDay: number
    snacksPerDay: number
  }
  groups: { days: Record<FoodGroup, number>; diversity: number }
  intake: {
    kcal: number
    /** Sample SD of daily energy. */
    kcalSd: number
    macros: Macros
    /** Share of energy from each macro. */
    split: { protein: number; carbs: number; fat: number }
    micros: Micros
  }
  processedDays: number
  /** Null until 3 days are logged. */
  pattern: DietPattern | null
}

const SLOT_NAME: Record<TimedSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

function sd(xs: number[]): number {
  if (xs.length < 2) return 0
  const mu = mean(xs)
  return Math.sqrt(xs.reduce((a, x) => a + (x - mu) ** 2, 0) / (xs.length - 1))
}

/** Food log analysis over the `days` days ending on `end` (inclusive). */
export function weekAnalysis(meals: Meal[], end: string, days = 7): WeekAnalysis {
  const window = Array.from({ length: days }, (_, i) => shiftDate(end, i - days + 1))
  const rows = window.map((d) => dayRow(meals, d))
  const on = rows.filter((r) => r.logged)
  const n = on.length
  const spread = mealPatterns(meals, end, days).spread
  const avgMacros = (k: keyof Macros) => mean(on.map((r) => r.macros[k]))
  const macros: Macros = {
    kcal: avgMacros('kcal'),
    protein: avgMacros('protein'),
    carbs: avgMacros('carbs'),
    fat: avgMacros('fat'),
  }
  const a: WeekAnalysis = {
    window,
    logged: n,
    rows,
    timing: {
      breakfastMissed: on.filter((r) => !r.times.breakfast).length,
      spread,
      lateDinners: on.filter((r) => r.times.dinner && minutes(r.times.dinner) > LATE_DINNER).length,
      mainsPerDay: mean(on.map((r) => r.mains)),
      snacksPerDay: mean(on.map((r) => r.snacks)),
    },
    groups: {
      days: Object.fromEntries(
        FOOD_GROUPS.map((g) => [g, on.filter((r) => r.groups[g]).length]),
      ) as WeekAnalysis['groups']['days'],
      diversity: mean(on.map((r) => r.diversity)),
    },
    intake: {
      kcal: macros.kcal,
      kcalSd: sd(on.map((r) => r.macros.kcal)),
      macros,
      split: macroSplit(macros),
      micros: Object.fromEntries(
        MICRO_KEYS.map((k) => [k, mean(on.map((r) => r.micros[k]))]),
      ) as Micros,
    },
    processedDays: on.filter((r) => r.processed).length,
    pattern: null,
  }
  a.pattern = classifyPattern(a)
  return a
}

/**
 * The survey's four rules, applied in order to the logged days. "5 days a week" becomes
 * 5/7 of the days logged, so a short log is judged by the same proportions.
 */
export function classifyPattern(a: Omit<WeekAnalysis, 'pattern'>): DietPattern | null {
  const n = a.logged
  if (n < 3) return null
  const atLeast = (count: number, perWeek: number) => count >= (perWeek / 7) * n - 1e-9
  const atMost = (count: number, perWeek: number) => count <= (perWeek / 7) * n + 1e-9
  const of = `of ${n} days`
  const p = a.processedDays
  const { fruit, veg } = a.groups.days
  const make = (id: PatternId, reasons: string[]): DietPattern => ({
    id,
    name: DIET_PATTERNS[id].name,
    reasons,
  })

  if (atLeast(p, 5)) return make('processed', [`Packaged or fast food on ${p} ${of}`])
  if (atLeast(fruit, 5) && atLeast(veg, 5) && atMost(p, 2))
    return make('fruit-veg', [
      `Fruit on ${fruit} and vegetables on ${veg} ${of}`,
      `Packaged or fast food on ${p} ${of}`,
    ])
  const reasons: string[] = []
  if (atLeast(a.timing.breakfastMissed, 3))
    reasons.push(`Breakfast missed on ${a.timing.breakfastMissed} ${of}`)
  for (const s of TIMED) {
    const sp = a.timing.spread[s]
    if (sp != null && sp >= IRREGULAR_SPREAD)
      reasons.push(`${SLOT_NAME[s]} time moved by ${fmtSpread(sp)}`)
  }
  if (reasons.length) return make('irregular', reasons)
  return make('mixed', [
    `Fruit on ${fruit} and vegetables on ${veg} ${of}`,
    `Packaged or fast food on ${p} ${of}`,
  ])
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CSV_HEADER = [
  'date',
  'weekday',
  'logged',
  'main_meals',
  'snacks',
  'breakfast_time',
  'lunch_time',
  'dinner_time',
  'kcal',
  'protein_g',
  'carbs_g',
  'fat_g',
  'fibre_g',
  'iron_mg',
  'calcium_mg',
  'b12_ug',
  'vitd_ug',
  'cereal',
  'protein_foods',
  'veg',
  'fruit',
  'dairy',
  'diversity_score',
  'packaged_or_fast_food',
  'pattern',
]

const r1 = (x: number) => String(Math.round(x * 10) / 10)
const bit = (b: boolean) => (b ? '1' : '0')

/** One row per day for the study spreadsheet. Days with nothing logged are blank, not zero. */
export function weekCsv(a: WeekAnalysis): string {
  const pattern = a.pattern?.name ?? ''
  const lines = a.rows.map((r) => {
    const weekday = WEEKDAY[new Date(`${r.date}T12:00:00`).getDay()]
    if (!r.logged) return [r.date, weekday, '0', ...Array(21).fill(''), pattern].join(',')
    return [
      r.date,
      weekday,
      '1',
      String(r.mains),
      String(r.snacks),
      r.times.breakfast ?? '',
      r.times.lunch ?? '',
      r.times.dinner ?? '',
      String(Math.round(r.macros.kcal)),
      r1(r.macros.protein),
      r1(r.macros.carbs),
      r1(r.macros.fat),
      r1(r.micros.fibre),
      r1(r.micros.iron),
      String(Math.round(r.micros.calcium)),
      r1(r.micros.b12),
      r1(r.micros.vitD),
      ...FOOD_GROUPS.map((g) => bit(r.groups[g])),
      String(r.diversity),
      bit(r.processed),
      pattern,
    ].join(',')
  })
  return `${[CSV_HEADER.join(','), ...lines].join('\n')}\n`
}
