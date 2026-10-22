import { describe, expect, it } from 'vitest'
import {
  dayRow,
  FOOD_BY_ID,
  isProcessed,
  itemFromFood,
  type Meal,
  type MealSlot,
  PROCESSED_IDS,
  weekAnalysis,
  weekCsv,
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

/** A steady day: breakfast, lunch and dinner at fixed times. */
const steady = (d: string, extra: Meal[] = []): Meal[] => [
  m(d, 'breakfast', '08:30', [['poha', 1]]),
  m(d, 'lunch', '13:00', [
    ['roti', 2],
    ['dal-tadka', 1],
  ]),
  m(d, 'dinner', '20:00', [
    ['roti', 2],
    ['bhindi', 1],
  ]),
  ...extra,
]

describe('isProcessed', () => {
  it('flags packaged and fast food only', () => {
    expect(isProcessed(FOOD_BY_ID.maggi)).toBe(true)
    expect(isProcessed(FOOD_BY_ID.cola)).toBe(true)
    expect(isProcessed(FOOD_BY_ID.cheeseburger)).toBe(true)
    expect(isProcessed(FOOD_BY_ID.roti)).toBe(false)
    expect(isProcessed(FOOD_BY_ID.samosa)).toBe(false)
  })

  it('only lists foods that exist', () => {
    for (const id of PROCESSED_IDS) expect(FOOD_BY_ID[id], id).toBeDefined()
  })
})

describe('dayRow', () => {
  it('summarises one day', () => {
    const r = dayRow(
      [
        ...steady(day(0)),
        m(day(0), 'snack', '17:00', [['banana', 1]]),
        m(day(0), 'extra', '22:00', [['maggi', 1]]),
        m(day(1), 'lunch', '13:00', [['roti', 1]]),
      ],
      day(0),
    )
    expect(r.logged).toBe(true)
    expect(r.mains).toBe(3)
    expect(r.snacks).toBe(2)
    expect(r.times).toEqual({ breakfast: '08:30', lunch: '13:00', dinner: '20:00' })
    expect(r.groups.fruit).toBe(true)
    expect(r.groups.dairy).toBe(false)
    expect(r.diversity).toBe(4)
    expect(r.processed).toBe(true)
    expect(r.macros.kcal).toBeGreaterThan(0)
  })

  it('marks a day with nothing logged', () => {
    const r = dayRow([], day(0))
    expect(r.logged).toBe(false)
    expect(r.diversity).toBe(0)
    expect(r.times.lunch).toBeNull()
  })
})

describe('weekAnalysis', () => {
  it('returns empty stats and no pattern when nothing is logged', () => {
    const a = weekAnalysis([], END)
    expect(a.logged).toBe(0)
    expect(a.rows).toHaveLength(7)
    expect(a.rows.every((r) => !r.logged)).toBe(true)
    expect(a.pattern).toBeNull()
  })

  it('needs three logged days for a pattern', () => {
    const a = weekAnalysis([...steady(day(0)), ...steady(day(1))], END)
    expect(a.logged).toBe(2)
    expect(a.pattern).toBeNull()
  })

  it('averages intake over logged days with a sample SD', () => {
    const a = weekAnalysis(
      [m(day(0), 'lunch', '13:00', [['roti', 2]]), m(day(1), 'lunch', '13:00', [['roti', 4]])],
      END,
    )
    expect(a.intake.kcal).toBeCloseTo(306, 0)
    expect(a.intake.kcalSd).toBeCloseTo(144.2, 0)
  })

  it('counts late dinners, group days and mean diversity', () => {
    const meals = [
      ...steady(day(0)),
      m(day(1), 'dinner', '22:15', [['roti', 2]]),
      m(day(2), 'dinner', '21:45', [['banana', 1]]),
    ]
    const a = weekAnalysis(meals, END)
    expect(a.timing.lateDinners).toBe(2)
    expect(a.groups.days.cereal).toBe(2)
    expect(a.groups.days.fruit).toBe(1)
    // steady day: cereal, protein, veg = 3; roti day: 1; banana day: 1
    expect(a.groups.diversity).toBeCloseTo(5 / 3, 5)
  })

  it('classifies a processed-food dominant week first', () => {
    const meals: Meal[] = []
    for (let i = 0; i < 7; i++)
      meals.push(
        ...steady(day(i), [
          m(day(i), 'extra', '11:00', [['banana', 1]]),
          ...(i < 5 ? [m(day(i), 'extra', '17:00', [['namkeen', 1]])] : []),
        ]),
      )
    const a = weekAnalysis(meals, END)
    expect(a.processedDays).toBe(5)
    expect(a.pattern?.id).toBe('processed')
    expect(a.pattern?.reasons[0]).toBe('Packaged or fast food on 5 of 7 days')
  })

  it('classifies a fruit and veg rich week', () => {
    const meals: Meal[] = []
    for (let i = 0; i < 7; i++)
      meals.push(...steady(day(i), [m(day(i), 'extra', '11:00', [['banana', 1]])]))
    expect(weekAnalysis(meals, END).pattern?.id).toBe('fruit-veg')
  })

  it('classifies missed breakfasts as irregular', () => {
    const meals: Meal[] = []
    for (let i = 0; i < 7; i++)
      meals.push(...steady(day(i)).filter((x) => i >= 3 || x.slot !== 'breakfast'))
    const a = weekAnalysis(meals, END)
    expect(a.timing.breakfastMissed).toBe(3)
    expect(a.pattern?.id).toBe('irregular')
    expect(a.pattern?.reasons).toContain('Breakfast missed on 3 of 7 days')
  })

  it('classifies a meal time that moves 2 h or more as irregular', () => {
    const meals: Meal[] = []
    for (let i = 0; i < 7; i++)
      meals.push(
        m(day(i), 'breakfast', '08:30', [['poha', 1]]),
        m(day(i), 'lunch', i === 0 ? '12:00' : '14:10', [['roti', 2]]),
      )
    const a = weekAnalysis(meals, END)
    expect(a.pattern?.id).toBe('irregular')
    expect(a.pattern?.reasons).toContain('Lunch time moved by 2 h 10 min')
  })

  it('calls everything else mixed or moderate', () => {
    const meals: Meal[] = []
    for (let i = 0; i < 7; i++) meals.push(...steady(day(i)))
    expect(weekAnalysis(meals, END).pattern?.id).toBe('mixed')
  })

  it('scales the 7-day rules to the days logged', () => {
    const meals: Meal[] = []
    for (let i = 0; i < 4; i++)
      meals.push(...steady(day(i), i < 3 ? [m(day(i), 'extra', '17:00', [['cola', 1]])] : []))
    // 3 of 4 days is at least 5/7 of the week.
    expect(weekAnalysis(meals, END).pattern?.id).toBe('processed')
  })
})

describe('weekCsv', () => {
  it('writes a header and one row per day, blank for days not logged', () => {
    const meals = steady(day(0), [m(day(0), 'extra', '17:00', [['maggi', 1]])])
    const lines = weekCsv(weekAnalysis(meals, END)).trim().split('\n')
    expect(lines).toHaveLength(8)
    expect(lines[0]).toBe(
      'date,weekday,logged,main_meals,snacks,breakfast_time,lunch_time,dinner_time,kcal,protein_g,carbs_g,fat_g,fibre_g,iron_mg,calcium_mg,b12_ug,vitd_ug,cereal,protein_foods,veg,fruit,dairy,diversity_score,packaged_or_fast_food,pattern',
    )
    const last = lines[7].split(',')
    expect(last[0]).toBe(END)
    expect(last[1]).toBe('Tue')
    expect(last[2]).toBe('1')
    expect(last.slice(3, 8)).toEqual(['3', '1', '08:30', '13:00', '20:00'])
    expect(last[23]).toBe('1')
    const first = lines[1].split(',')
    expect(first[2]).toBe('0')
    expect(first.slice(3, 24).every((v) => v === '')).toBe(true)
  })
})
