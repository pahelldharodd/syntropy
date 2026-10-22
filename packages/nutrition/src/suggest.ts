import { isProcessed, type WeekAnalysis } from './analysis'
import { MAIN_SLOTS, type MainSlot, type Meal, mealTotals } from './meals'
import {
  dayGroups,
  dayMicros,
  FOOD_GROUPS,
  type FoodGroup,
  GROUP_INFO,
  itemFood,
  MICRO_INFO,
  type Micros,
} from './micros'
import { fmtSpread, shiftDate, type TimedSlot } from './patterns'

/*
 * Rule-based suggestions from a week of logging, and a same-day forecast that warns before a
 * gap happens. Every suggestion carries the evidence that triggered it. Thresholds:
 * - breakfast missed on 3+ of 7 days, a meal time moving by 2 h+, dinner after 21:30 on 3+ days
 *   (the survey's irregular-eating rule);
 * - fruit on under half the days, vegetables on under 70 %, under 4 of 5 food groups a day;
 * - packaged or fast food on 3+ of 7 days;
 * - protein under 80 % of target; fibre, iron or calcium under two thirds of target;
 * - fat over 30 % of energy (WHO and ICMR-NIN upper limit).
 * Food ideas follow the user's diet and stay within everyday Indian foods.
 */

export type DietPref = 'veg' | 'egg' | 'nonveg' | 'vegan' | 'jain'

export interface SuggestContext {
  /** Null when the user has not said; suggestions then stay vegetarian. */
  diet: DietPref | null
  proteinTarget: number
  /** Daily micronutrient targets, from `microTargets`. */
  micros: Micros
}

export interface Suggestion {
  id: string
  title: string
  /** What the log shows, e.g. "Fruit on 2 of 7 days". */
  evidence: string
  /** One concrete change. */
  action: string
  /** The meal whose reminder should carry it. */
  slot?: TimedSlot
  score: number
}

type Need = 'breakfast' | 'protein' | 'fibre' | 'iron' | 'calcium' | FoodGroup

function action(need: Need, diet: DietPref | null): string {
  const vegan = diet === 'vegan'
  const eggs = diet === 'egg' || diet === 'nonveg'
  switch (need) {
    case 'breakfast':
      return vegan
        ? 'Keep a 5-minute breakfast ready: poha, besan chilla or fruit with peanuts.'
        : eggs
          ? 'Keep a 5-minute breakfast ready: boiled eggs, poha, or fruit with dahi.'
          : 'Keep a 5-minute breakfast ready: poha, besan chilla, or fruit with dahi.'
    case 'protein':
      return diet === 'nonveg'
        ? 'Add eggs, chicken or a katori of dal to one more meal.'
        : diet === 'egg'
          ? 'Add two eggs or a katori of dal to one more meal.'
          : vegan
            ? 'Add a katori of dal, chana or tofu to one more meal.'
            : 'Add a katori of dal, paneer or dahi to one more meal.'
    case 'fibre':
      return 'Pick roti or brown rice over white rice, and add rajma, chana or a salad.'
    case 'iron':
      return diet === 'nonveg'
        ? 'Have dal palak, chana, eggs or meat with a squeeze of lemon; vitamin C helps the body absorb iron.'
        : 'Have dal palak, chana or poha with a squeeze of lemon; vitamin C helps the body absorb iron.'
    case 'calcium':
    case 'dairy':
      return vegan
        ? 'Ragi, tofu and til (sesame) are good non-dairy sources of calcium.'
        : 'Add a katori of dahi or a glass of milk; ragi and til help too.'
    case 'fruit':
      return 'Keep a banana, guava or orange for the 4 pm gap, or add one to breakfast.'
    case 'veg':
      return 'Add a katori of sabzi or a salad at lunch.'
    case 'cereal':
      return 'A roti or a katori of rice with meals gives steady energy.'
  }
}

const SLOT_WORD: Record<TimedSlot, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
}
const GROUP_SLOT: Record<FoodGroup, TimedSlot> = {
  cereal: 'breakfast',
  protein: 'lunch',
  veg: 'lunch',
  fruit: 'breakfast',
  dairy: 'breakfast',
}

/** "9.4", "12", "640": one decimal below 10. */
const num = (v: number) => (v < 10 ? v.toFixed(1) : String(Math.round(v)))
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** Suggestions for the week, strongest first. Empty until 3 days are logged. */
export function suggestions(a: WeekAnalysis, c: SuggestContext): Suggestion[] {
  const n = a.logged
  if (n < 3) return []
  const out: Suggestion[] = []
  const add = (s: Omit<Suggestion, 'score'>, priority: number, severity: number) =>
    out.push({ ...s, score: priority * (1 + clamp01(severity)) })
  const of = `of ${n} days`
  const atLeast = (count: number, perWeek: number) => count >= (perWeek / 7) * n - 1e-9

  const missed = a.timing.breakfastMissed
  if (atLeast(missed, 3))
    add(
      {
        id: 'breakfast',
        title: 'Make breakfast regular',
        evidence: `Breakfast missed on ${missed} ${of}`,
        action: action('breakfast', c.diet),
        slot: 'breakfast',
      },
      1,
      missed / n,
    )

  const widest = (Object.entries(a.timing.spread) as [TimedSlot, number | null][])
    .filter((x): x is [TimedSlot, number] => x[1] != null)
    .sort((x, y) => y[1] - x[1])[0]
  if (widest && widest[1] >= 120) {
    const [slot, min] = widest
    add(
      {
        id: 'timing',
        title: `A steadier ${SLOT_WORD[slot]} time`,
        evidence: `${slot[0].toUpperCase()}${slot.slice(1)} time moved by ${fmtSpread(min)}`,
        action: `Aim to have ${SLOT_WORD[slot]} within half an hour of the same time each day; a meal reminder helps.`,
        slot,
      },
      0.9,
      (min - 120) / 120,
    )
  }

  const late = a.timing.lateDinners
  if (atLeast(late, 3))
    add(
      {
        id: 'late-dinner',
        title: 'Earlier dinners',
        evidence: `Dinner after 9:30 pm on ${late} ${of}`,
        action: 'Try finishing dinner by 9 pm, two to three hours before bed.',
        slot: 'dinner',
      },
      0.7,
      late / n,
    )

  const days = a.groups.days
  const covered = new Set<FoodGroup>()
  if (days.fruit / n < 0.5) {
    covered.add('fruit')
    add(
      {
        id: 'fruit',
        title: 'More fruit',
        evidence: `Fruit on ${days.fruit} ${of}`,
        action: action('fruit', c.diet),
        slot: 'breakfast',
      },
      0.9,
      (0.5 - days.fruit / n) / 0.5,
    )
  }
  if (days.veg / n < 0.7) {
    covered.add('veg')
    add(
      {
        id: 'veg',
        title: 'More vegetables',
        evidence: `Vegetables on ${days.veg} ${of}`,
        action: action('veg', c.diet),
        slot: 'lunch',
      },
      0.9,
      (0.7 - days.veg / n) / 0.7,
    )
  }

  const p = a.processedDays
  if (atLeast(p, 3))
    add(
      {
        id: 'processed',
        title: 'Fewer packaged foods',
        evidence: `Packaged or fast food on ${p} ${of}`,
        action: 'Swap one packaged snack for roasted chana, makhana or a fruit.',
      },
      0.85,
      p / n,
    )

  const protein = a.intake.macros.protein / Math.max(1, c.proteinTarget)
  if (protein < 0.8) {
    covered.add('protein')
    add(
      {
        id: 'protein',
        title: 'More protein',
        evidence: `Protein averaged ${Math.round(a.intake.macros.protein)} of ${Math.round(c.proteinTarget)} g a day`,
        action: action('protein', c.diet),
        slot: 'dinner',
      },
      0.8,
      (0.8 - protein) / 0.8,
    )
  }

  const div = a.groups.diversity
  if (div < 4) {
    const g = FOOD_GROUPS.filter((x) => !covered.has(x)).sort((x, y) => days[x] - days[y])[0]
    if (g)
      add(
        {
          id: 'diversity',
          title: 'More food groups',
          evidence: `${div.toFixed(1)} of 5 food groups a day; ${GROUP_INFO[g].name.toLowerCase()} on ${days[g]} ${of}`,
          action: action(g, c.diet),
          slot: GROUP_SLOT[g],
        },
        0.8,
        (4 - div) / 4,
      )
  }

  for (const [k, slot] of [
    ['fibre', 'lunch'],
    ['iron', 'dinner'],
    ['calcium', 'breakfast'],
  ] as const) {
    const v = a.intake.micros[k]
    const t = c.micros[k]
    const r = v / Math.max(0.01, t)
    if (r < 2 / 3)
      add(
        {
          id: k,
          title: `More ${MICRO_INFO[k].name.toLowerCase()}`,
          evidence: `${MICRO_INFO[k].name} averaged ${k === 'calcium' ? Math.round(v) : num(v)} of ${num(t)} ${MICRO_INFO[k].unit} a day`,
          action: action(k, c.diet),
          slot,
        },
        0.7,
        (2 / 3 - r) / (2 / 3),
      )
  }

  const fat = a.intake.split.fat
  if (fat > 0.3)
    add(
      {
        id: 'fat',
        title: 'A little less oil',
        evidence: `Fat gave ${Math.round(fat * 100)}% of energy (guide: under 30%)`,
        action:
          c.diet === 'vegan'
            ? 'Use a little less oil, and roast or steam instead of frying.'
            : 'Use a little less oil or ghee in sabzi and dal, and roast or steam instead of frying.',
        slot: 'dinner',
      },
      0.6,
      (fat - 0.3) / 0.15,
    )

  return out.sort((x, y) => y.score - x.score)
}

/** The text for each meal reminder: the strongest suggestion that belongs to that meal. */
export function reminderCopy(list: Suggestion[]): Partial<Record<TimedSlot, string>> {
  const out: Partial<Record<TimedSlot, string>> = {}
  for (const s of list) if (s.slot && !out[s.slot]) out[s.slot] = `${s.evidence}. ${s.action}`
  return out
}

export interface HeadsUp {
  id: string
  text: string
  fix: string
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const LATE_DINNER = 21 * 60 + 30

/** Minutes after midnight as "HH:MM". */
function clock(min: number): string {
  const m = Math.round(min)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

const joinAnd = (xs: string[]) =>
  xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

const SLOT_NOUN: Record<MainSlot, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  snack: 'snack',
  dinner: 'dinner',
}

/**
 * Preemptive heads-ups for today: what the rest of the day will likely add, from the last 14 days
 * of the same meals, and which gaps that still leaves; plus habits from the last 7 days that
 * usually show up later (a missed breakfast, an evening packaged snack, a late dinner).
 * At most two, most useful first.
 */
export function forecastToday(
  meals: Meal[],
  date: string,
  nowMin: number,
  c: SuggestContext,
): HeadsUp[] {
  const hist = Array.from({ length: 14 }, (_, i) => shiftDate(date, -(i + 1)))
    .map((d) => meals.filter((m) => m.date === d && m.items.length))
    .filter((ms) => ms.length)
  if (hist.length < 3) return []
  const todays = meals.filter((m) => m.date === date && m.items.length)
  const has = (ms: Meal[], slot: MainSlot) => ms.some((m) => m.slot === slot)
  const out: (HeadsUp & { rank: number })[] = []

  if (!has(todays, 'breakfast')) {
    const times = hist
      .map((ms) => ms.find((m) => m.slot === 'breakfast')?.time)
      .filter((t): t is string => !!t)
      .map(minutes)
    const missed = hist.length - times.length
    const usual = times.length ? median(times) : 9 * 60
    if (missed >= (3 / 7) * hist.length && nowMin >= 5 * 60 && nowMin <= usual + 120)
      out.push({
        id: 'breakfast',
        text: `Breakfast was missed on ${missed} of the last ${hist.length} days.`,
        fix: action('breakfast', c.diet),
        rank: -1,
      })
  }

  // The meals still likely today: not logged yet, and their usual time is not long past.
  const ahead: { slot: MainSlot; at: number; p: number; meals: Meal[][] }[] = []
  for (const slot of MAIN_SLOTS) {
    if (has(todays, slot)) continue
    const past = hist.map((ms) => ms.filter((m) => m.slot === slot)).filter((x) => x.length)
    if (!past.length) continue
    const at = median(past.map((x) => minutes(x[0].time)))
    if (at + 90 < nowMin) continue
    ahead.push({ slot, at, p: past.length / hist.length, meals: past })
  }
  ahead.sort((x, y) => x.at - y.at)

  // Nothing to forecast before the first meal, or late at night with no meals left.
  if (todays.length && (ahead.length || nowMin < 21 * 60)) {
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
    const eaten = dayMicros(todays).total
    let protein = todays.reduce((s, m) => s + mealTotals(m).protein, 0)
    const micros = { ...eaten }
    const eatenGroups = dayGroups(todays)
    const missLater: Record<FoodGroup, number> = {
      cereal: 1,
      protein: 1,
      veg: 1,
      fruit: 1,
      dairy: 1,
    }
    for (const s of ahead) {
      protein += s.p * avg(s.meals.map((ms) => ms.reduce((t, m) => t + mealTotals(m).protein, 0)))
      for (const k of ['fibre', 'iron', 'calcium'] as const)
        micros[k] += s.p * avg(s.meals.map((ms) => dayMicros(ms).total[k]))
      for (const g of FOOD_GROUPS) {
        const share = s.meals.filter((ms) => dayGroups(ms).has(g)).length / s.meals.length
        missLater[g] *= 1 - s.p * share
      }
    }

    const lead = ahead.length
      ? `With your usual ${joinAnd(ahead.map((s) => SLOT_NOUN[s.slot]))}, today would end near`
      : 'Today is heading for'
    const pr = protein / Math.max(1, c.proteinTarget)
    if (pr < 0.8)
      out.push({
        id: 'protein',
        text: `${lead} ${Math.round(protein)} of ${Math.round(c.proteinTarget)} g protein.`,
        fix: action('protein', c.diet),
        rank: pr,
      })
    for (const k of ['fibre', 'iron', 'calcium'] as const) {
      const r = micros[k] / Math.max(0.01, c.micros[k])
      if (r < 2 / 3)
        out.push({
          id: k,
          text: `${lead} ${k === 'calcium' ? Math.round(micros[k]) : num(micros[k])} of ${num(c.micros[k])} ${MICRO_INFO[k].unit} ${MICRO_INFO[k].name.toLowerCase()}.`,
          fix: action(k, c.diet),
          rank: r,
        })
    }
    for (const [g, word] of [
      ['fruit', 'fruit'],
      ['veg', 'vegetables'],
    ] as const)
      if (!eatenGroups.has(g) && missLater[g] > 0.5)
        out.push({
          id: g,
          text: ahead.length
            ? `No ${word} yet today, and your usual meals from here rarely include any.`
            : `No ${word} yet today.`,
          fix: action(g, c.diet),
          rank: 0.5,
        })
  }

  // Habits from the last 7 days that usually turn up later in the day.
  const week = hist.filter((ms) => ms[0].date >= shiftDate(date, -7))
  if (week.length >= 3) {
    const packaged = (m: Meal) =>
      m.items.some((it) => {
        const f = itemFood(it)
        return !!f && isProcessed(f)
      })
    const times = week
      .map((ms) => ms.find(packaged)?.time)
      .filter((t): t is string => !!t)
      .map(minutes)
    const at = times.length ? median(times) : 0
    if (!todays.some(packaged) && times.length >= (3 / 7) * week.length && nowMin <= at + 60)
      out.push({
        id: 'processed',
        text: `Packaged snacks turned up on ${times.length} of the last ${week.length} days, usually around ${clock(Math.round(at / 15) * 15)}.`,
        fix: 'Keep roasted chana, makhana or a fruit within reach for then.',
        rank: 0.6,
      })
    const late = week.filter((ms) =>
      ms.some((m) => m.slot === 'dinner' && minutes(m.time) > LATE_DINNER),
    ).length
    if (!has(todays, 'dinner') && late >= (3 / 7) * week.length && nowMin < LATE_DINNER)
      out.push({
        id: 'late-dinner',
        text: `Dinner ran past 9:30 pm on ${late} of the last ${week.length} days.`,
        fix: 'Starting dinner by 8:30 tonight leaves a calmer gap before bed.',
        rank: 0.65,
      })
  }

  return out
    .sort((x, y) => x.rank - y.rank)
    .slice(0, 2)
    .map(({ rank, ...h }) => h)
}
