import { describe, expect, it } from 'vitest'
import {
  FOOD_BY_ID,
  forecastToday,
  itemFromFood,
  type Meal,
  type MealSlot,
  type Micros,
  reminderCopy,
  type SuggestContext,
  suggestions,
  weekAnalysis,
} from './index'

const END = '2026-10-20'
const day = (n: number) => `2026-10-${String(20 - n).padStart(2, '0')}`
let seq = 0
const m = (date: string, slot: MealSlot, time: string, foods: [string, number][]): Meal => ({
  id: `m${seq++}`,
  date,
  slot,
  time,
  items: foods.map(([id, q]) => itemFromFood(FOOD_BY_ID[id], q, 'manual')),
  createdAt: 0,
})

const LOW: Micros = { fibre: 1, iron: 1, calcium: 1, b12: 0.1, vitD: 0.1 }
const ctx = (over: Partial<SuggestContext> = {}): SuggestContext => ({
  diet: 'nonveg',
  proteinTarget: 1,
  micros: LOW,
  ...over,
})

const breakfast = (d: string) => m(d, 'breakfast', '08:30', [['poha', 1]])
const lunch = (d: string) =>
  m(d, 'lunch', '13:00', [
    ['roti', 2],
    ['dal-tadka', 1],
    ['dahi', 1],
  ])
// Lean enough to stay under 30 % of energy from fat (oil-cooked sabzis often reach 50–75 %).
const dinner = (d: string, time = '20:00') =>
  m(d, 'dinner', time, [
    ['roti', 2],
    ['rice', 1],
    ['kachumber', 1],
  ])
const fruit = (d: string) => m(d, 'extra', '16:00', [['banana', 1]])

/** Seven steady, varied days. */
function goodWeek(): Meal[] {
  const out: Meal[] = []
  for (let i = 0; i < 7; i++)
    out.push(breakfast(day(i)), lunch(day(i)), dinner(day(i)), fruit(day(i)))
  return out
}

const ids = (meals: Meal[], c = ctx()) => suggestions(weekAnalysis(meals, END), c).map((s) => s.id)
const find = (meals: Meal[], id: string, c = ctx()) =>
  suggestions(weekAnalysis(meals, END), c).find((s) => s.id === id)

describe('suggestions', () => {
  it('waits for three logged days', () => {
    expect(
      suggestions(
        weekAnalysis(
          goodWeek().filter((x) => x.date >= day(1)),
          END,
        ),
        ctx(),
      ),
    ).toEqual([])
  })

  it('has nothing to say about a steady, varied week', () => {
    expect(ids(goodWeek())).toEqual([])
  })

  it('suggests a regular breakfast', () => {
    const meals = goodWeek().filter((x) => !(x.slot === 'breakfast' && x.date <= day(4)))
    const s = find(meals, 'breakfast')
    expect(s?.evidence).toBe('Breakfast missed on 3 of 7 days')
    expect(s?.slot).toBe('breakfast')
  })

  it('suggests a steadier meal time', () => {
    const meals = goodWeek().map((x) =>
      x.slot === 'lunch' && x.date === day(0) ? { ...x, time: '15:10' } : x,
    )
    const s = find(meals, 'timing')
    expect(s?.evidence).toBe('Lunch time moved by 2 h 10 min')
    expect(s?.slot).toBe('lunch')
  })

  it('suggests earlier dinners', () => {
    const meals = goodWeek().map((x) =>
      x.slot === 'dinner' && x.date <= day(4) ? { ...x, time: '22:00' } : x,
    )
    expect(find(meals, 'late-dinner')?.evidence).toBe('Dinner after 9:30 pm on 3 of 7 days')
  })

  it('suggests fruit and vegetables', () => {
    const meals = goodWeek().filter((x) => x.slot !== 'extra' && x.slot !== 'dinner')
    expect(find(meals, 'fruit')?.evidence).toBe('Fruit on 0 of 7 days')
    // Poha counts as a vegetable dish, so take breakfast out too.
    expect(
      find(
        meals.filter((x) => x.slot !== 'breakfast'),
        'veg',
      )?.evidence,
    ).toBe('Vegetables on 0 of 7 days')
  })

  it('names the food group eaten least for low diversity', () => {
    const meals = Array.from({ length: 7 }, (_, i) => m(day(i), 'lunch', '13:00', [['roti', 3]]))
    const s = find(meals, 'diversity')
    expect(s?.evidence).toBe('1.0 of 5 food groups a day; dal & protein on 0 of 7 days')
  })

  it('suggests a swap for packaged food', () => {
    const meals = [
      ...goodWeek(),
      ...[0, 1, 2].map((i) => m(day(i), 'extra', '18:00', [['namkeen', 1]])),
    ]
    expect(find(meals, 'processed')?.evidence).toBe('Packaged or fast food on 3 of 7 days')
  })

  it('compares protein and minerals with targets', () => {
    const c = ctx({ proteinTarget: 500, micros: { ...LOW, iron: 1000 } })
    expect(find(goodWeek(), 'protein', c)?.evidence).toMatch(
      /^Protein averaged \d+ of 500 g a day$/,
    )
    expect(find(goodWeek(), 'iron', c)?.evidence).toMatch(/^Iron averaged [\d.]+ of 1000 mg a day$/)
  })

  it('flags a high-fat week', () => {
    const meals = Array.from({ length: 7 }, (_, i) =>
      m(day(i), 'lunch', '13:00', [
        ['samosa', 3],
        ['banana', 1],
      ]),
    )
    expect(find(meals, 'fat')?.evidence).toMatch(/^Fat gave \d+% of energy \(guide: under 30%\)$/)
  })

  it('ranks the strongest suggestion first', () => {
    const meals = Array.from({ length: 7 }, (_, i) => m(day(i), 'lunch', '13:00', [['maggi', 1]]))
    const s = suggestions(weekAnalysis(meals, END), ctx())
    expect(s.length).toBeGreaterThan(2)
    for (let i = 1; i < s.length; i++) expect(s[i - 1].score).toBeGreaterThanOrEqual(s[i].score)
  })

  const rough = () => {
    const meals: Meal[] = []
    for (let i = 0; i < 7; i++)
      meals.push(
        m(day(i), 'lunch', '13:00', [['maggi', 1]]),
        m(day(i), 'dinner', '22:30', [['samosa', 2]]),
      )
    return weekAnalysis(meals, END)
  }
  const hard = {
    proteinTarget: 500,
    micros: { fibre: 100, iron: 100, calcium: 5000, b12: 1, vitD: 1 },
  }

  it('keeps vegetarian suggestions vegetarian', () => {
    for (const s of suggestions(rough(), ctx({ ...hard, diet: 'veg' })))
      expect(s.action).not.toMatch(/egg|chicken|fish|meat/i)
  })

  it('keeps vegan suggestions free of dairy', () => {
    for (const s of suggestions(rough(), ctx({ ...hard, diet: 'vegan' })))
      expect(s.action).not.toMatch(/egg|chicken|fish|meat|dahi|milk|paneer|curd/i)
  })
})

describe('forecastToday', () => {
  const T = day(0)
  const history = (withFruit: boolean) => {
    const out: Meal[] = []
    for (let i = 1; i <= 7; i++) {
      out.push(breakfast(day(i)), lunch(day(i)), dinner(day(i)))
      if (withFruit) out.push(m(day(i), 'lunch', '13:00', [['banana', 1]]))
    }
    return out
  }

  it('warns before the day ends when usual meals will not close a gap', () => {
    const meals = [
      ...history(true),
      breakfast(T),
      lunch(T),
      m(T, 'extra', '11:00', [['banana', 1]]),
    ]
    const h = forecastToday(meals, T, 14 * 60, ctx({ micros: { ...LOW, iron: 1000 } }))
    expect(h[0]?.id).toBe('iron')
    expect(h[0].text).toMatch(/dinner/)
    expect(h[0].text).toMatch(/of 1000 mg iron/)
  })

  it('stays quiet when the day is on track', () => {
    const meals = [
      ...history(true),
      breakfast(T),
      lunch(T),
      m(T, 'extra', '11:00', [['banana', 1]]),
    ]
    expect(forecastToday(meals, T, 14 * 60, ctx())).toEqual([])
  })

  it('notices fruit is unlikely today', () => {
    const meals = [...history(false), breakfast(T), lunch(T)]
    expect(forecastToday(meals, T, 14 * 60, ctx()).map((h) => h.id)).toContain('fruit')
  })

  it('nudges breakfast on a morning it is often skipped', () => {
    const meals = history(true).filter((x) => !(x.slot === 'breakfast' && x.date >= day(4)))
    const h = forecastToday(meals, T, 8 * 60, ctx())
    expect(h[0]?.id).toBe('breakfast')
    expect(h[0].text).toBe('Breakfast was missed on 4 of the last 7 days.')
  })

  it('expects the evening packaged snack before it happens', () => {
    const meals = [
      ...history(true),
      ...[1, 2, 4, 6].map((i) => m(day(i), 'extra', '21:00', [['namkeen', 1]])),
      breakfast(T),
      lunch(T),
      fruit(T),
    ]
    const h = forecastToday(meals, T, 14 * 60, ctx())
    expect(h.map((x) => x.id)).toEqual(['processed'])
    expect(h[0].text).toBe(
      'Packaged snacks turned up on 4 of the last 7 days, usually around 21:00.',
    )
    expect(forecastToday(meals, T, 22 * 60 + 30, ctx())).toEqual([])
  })

  it('expects a late dinner while there is time to start earlier', () => {
    const meals = [
      ...history(true).map((x) =>
        x.slot === 'dinner' && x.date >= day(3) ? { ...x, time: '22:00' } : x,
      ),
      breakfast(T),
      lunch(T),
      fruit(T),
    ]
    const h = forecastToday(meals, T, 18 * 60, ctx())
    expect(h.map((x) => x.id)).toEqual(['late-dinner'])
    expect(h[0].text).toBe('Dinner ran past 9:30 pm on 3 of the last 7 days.')
  })

  it('needs a few days of history and returns at most two', () => {
    expect(forecastToday([breakfast(day(1)), lunch(T)], T, 14 * 60, ctx())).toEqual([])
    const c = ctx({
      proteinTarget: 500,
      micros: { fibre: 100, iron: 100, calcium: 5000, b12: 1, vitD: 1 },
    })
    expect(forecastToday([...history(false), lunch(T)], T, 14 * 60, c).length).toBe(2)
  })
})

describe('reminderCopy', () => {
  it('puts the first suggestion for each meal into its reminder', () => {
    const copy = reminderCopy([
      {
        id: 'a',
        title: '',
        evidence: 'Breakfast missed on 3 of 7 days',
        action: 'Keep poha ready.',
        slot: 'breakfast',
        score: 2,
      },
      { id: 'b', title: '', evidence: 'Other', action: 'Ignore me.', slot: 'breakfast', score: 1 },
      {
        id: 'c',
        title: '',
        evidence: 'Vegetables on 2 of 7 days',
        action: 'Add sabzi.',
        slot: 'lunch',
        score: 1,
      },
      { id: 'd', title: '', evidence: 'No slot', action: 'Nowhere.', score: 1 },
    ])
    expect(copy).toEqual({
      breakfast: 'Breakfast missed on 3 of 7 days. Keep poha ready.',
      lunch: 'Vegetables on 2 of 7 days. Add sabzi.',
    })
  })
})
