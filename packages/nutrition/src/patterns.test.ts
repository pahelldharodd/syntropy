import { describe, expect, it } from 'vitest'
import {
  FOOD_BY_ID,
  fmtSpread,
  itemFromFood,
  type Meal,
  type MealSlot,
  mealPatterns,
} from './index'

const END = '2026-10-20'
const day = (n: number) => `2026-10-${String(20 - n).padStart(2, '0')}`
let seq = 0
const m = (date: string, slot: MealSlot, time: string, food = 'roti'): Meal => ({
  id: `m${seq++}`,
  date,
  slot,
  time,
  items: [itemFromFood(FOOD_BY_ID[food], 1, 'manual')],
  createdAt: 0,
})

describe('meal patterns', () => {
  it('counts breakfast over the days that have any meal', () => {
    const meals: Meal[] = []
    for (let i = 0; i < 7; i++) {
      meals.push(m(day(i), 'lunch', '13:00'))
      if (i < 4) meals.push(m(day(i), 'breakfast', '08:30'))
    }
    const p = mealPatterns(meals, END)
    expect(p.window).toHaveLength(7)
    expect(p.window[6]).toBe(END)
    expect(p.logged).toBe(7)
    expect(p.breakfast).toBe(4)
  })

  it('does not count a day with nothing logged as a skipped breakfast', () => {
    const meals = [m(day(0), 'breakfast', '08:00'), m(day(1), 'lunch', '13:00')]
    const p = mealPatterns(meals, END)
    expect(p.logged).toBe(2)
    expect(p.breakfast).toBe(1)
  })

  it('ignores meals outside the window', () => {
    const p = mealPatterns([m('2026-10-01', 'breakfast', '08:00')], END)
    expect(p.logged).toBe(0)
  })

  it('measures how much a meal time moves', () => {
    const p = mealPatterns([m(day(0), 'lunch', '12:30'), m(day(1), 'lunch', '14:40')], END)
    expect(p.spread.lunch).toBe(130)
  })

  it('has no spread for a meal logged once', () => {
    const p = mealPatterns([m(day(0), 'lunch', '12:30')], END)
    expect(p.spread.lunch).toBeNull()
  })

  it('returns null rows when nothing is logged', () => {
    const p = mealPatterns([], END)
    expect(p.logged).toBe(0)
    expect(p.breakfast).toBeNull()
    expect(p.fruitDays).toBeNull()
    expect(p.vegDays).toBeNull()
    expect(p.extrasPerDay).toBeNull()
  })

  it('counts fruit days, vegetable days and extras', () => {
    const p = mealPatterns(
      [
        m(day(0), 'lunch', '13:00', 'bhindi'),
        m(day(0), 'extra', '11:00', 'banana'),
        m(day(0), 'extra', '16:00', 'samosa'),
        m(day(1), 'lunch', '13:00', 'roti'),
      ],
      END,
    )
    expect(p.fruitDays).toBe(1)
    expect(p.vegDays).toBe(1)
    expect(p.extrasPerDay).toBe(1)
  })

  it('formats a time spread', () => {
    expect(fmtSpread(45)).toBe('45 min')
    expect(fmtSpread(130)).toBe('2 h 10 min')
    expect(fmtSpread(180)).toBe('3 h')
  })
})
