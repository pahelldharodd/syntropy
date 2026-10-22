import { describe, expect, it } from 'vitest'
import {
  dayGroups,
  dayMicros,
  FOOD_BY_ID,
  FOODS,
  foodMicros,
  itemFromFood,
  itemMicros,
  type Meal,
  type MealItem,
  MICRO_KEYS,
  microTargets,
} from './index'

const meal = (items: MealItem[]): Meal => ({
  id: 'm',
  date: '2026-10-20',
  slot: 'lunch',
  time: '13:00',
  items,
  createdAt: 0,
})

describe('micronutrients', () => {
  it('scales per-100 g values by the grams eaten', () => {
    const roti = FOOD_BY_ID.roti
    const m = itemMicros(itemFromFood(roti, 2, 'manual'))
    expect(m).not.toBeNull()
    expect(m?.fibre).toBeCloseTo((foodMicros(roti).fibre * 80) / 100, 2)
    expect(m?.iron).toBeCloseTo((foodMicros(roti).iron * 80) / 100, 2)
  })

  it('has finite, non-negative values for every food', () => {
    for (const f of FOODS)
      for (const k of MICRO_KEYS) {
        const v = foodMicros(f)[k]
        expect(Number.isFinite(v), `${f.id}.${k}`).toBe(true)
        expect(v, `${f.id}.${k}`).toBeGreaterThanOrEqual(0)
      }
  })

  it('returns null for an item that matches no food', () => {
    const it0 = itemFromFood(FOOD_BY_ID.roti, 1, 'photo')
    expect(itemMicros({ ...it0, foodId: undefined, name: 'grandma special xyz' })).toBeNull()
  })

  it('name-matches a photo item with no food id', () => {
    const it0 = itemFromFood(FOOD_BY_ID.dahi, 1, 'photo')
    expect(itemMicros({ ...it0, foodId: undefined, name: 'Dahi' })?.calcium).toBeGreaterThan(0)
  })

  it('uses the quantity as grams for g and ml items', () => {
    const it0 = itemFromFood(FOOD_BY_ID.rice, 1, 'manual')
    const m = itemMicros({ ...it0, unit: 'g', qty: 200 })
    expect(m?.fibre).toBeCloseTo(foodMicros(FOOD_BY_ID.rice).fibre * 2, 4)
  })

  it('totals a day and counts what it could estimate', () => {
    const unknown = { ...itemFromFood(FOOD_BY_ID.roti, 1, 'photo'), foodId: undefined, name: 'zzz' }
    const d = dayMicros([
      meal([
        itemFromFood(FOOD_BY_ID.dahi, 1, 'manual'),
        itemFromFood(FOOD_BY_ID.rice, 1, 'manual'),
      ]),
      meal([unknown]),
    ])
    expect(d.items).toBe(3)
    expect(d.estimated).toBe(2)
    expect(d.top.calcium[0]).toBe('Dahi')
    expect(d.total.calcium).toBeGreaterThan(100)
  })

  it('uses ICMR-NIN 2020 adult targets', () => {
    expect(microTargets('female', 2000)).toEqual({
      fibre: 30,
      iron: 29,
      calcium: 1000,
      b12: 2.5,
      vitD: 15,
    })
    expect(microTargets('male', 2400).iron).toBe(19)
    expect(microTargets('male', 2400).fibre).toBe(36)
  })
})

describe('food groups', () => {
  it('puts mixed dishes in every group they contain', () => {
    const g = dayGroups([
      meal([
        itemFromFood(FOOD_BY_ID['rajma-chawal'], 1, 'manual'),
        itemFromFood(FOOD_BY_ID.dahi, 1, 'manual'),
      ]),
    ])
    expect(g.has('cereal')).toBe(true)
    expect(g.has('protein')).toBe(true)
    expect(g.has('dairy')).toBe(true)
    expect(g.has('fruit')).toBe(false)
  })

  it('counts fruit and vegetables', () => {
    const g = dayGroups([
      meal([
        itemFromFood(FOOD_BY_ID.banana, 1, 'manual'),
        itemFromFood(FOOD_BY_ID.bhindi, 1, 'manual'),
      ]),
    ])
    expect(g.has('fruit')).toBe(true)
    expect(g.has('veg')).toBe(true)
  })
})
