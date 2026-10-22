'use client'

import {
  type DietPref,
  microTargets,
  reminderCopy,
  type Sex,
  type SuggestContext,
  suggestions,
  weekAnalysis,
} from '@syntropy/nutrition'
import { useEffect, useMemo, useRef } from 'react'
import { isNative } from '@/platform/native'
import { scheduleMealReminders } from '@/platform/notifications'
import { useGoal, useNutrition, useProfile, useSettings, useTraining, useUi } from '@/stores'
import { addDays, today } from './dates'
import { dayTargets, isTrainingDay, targetsFor, useToday } from './summary'

export const suggestContext = (
  sex: Sex,
  diet: DietPref | null,
  kcal: number,
  protein: number,
): SuggestContext => ({ diet, proteinTarget: protein, micros: microTargets(sex, kcal) })

/**
 * The 7 full days up to `date` (ending yesterday when `date` is today, since today is still
 * being logged), the 7 days before that for comparison, and this week's suggestions.
 */
export function useWeekAnalysis(date: string) {
  const t = useToday(date)
  const sex = useProfile((s) => s.sex)
  const diet = useProfile((s) => s.diet)
  const meals = useNutrition((s) => s.meals)
  return useMemo(() => {
    const end = date === today() ? addDays(date, -1) : date
    const ctx = suggestContext(sex, diet, t.dt.kcal, t.dt.protein)
    const a = weekAnalysis(meals, end)
    return {
      end,
      a,
      prev: weekAnalysis(meals, addDays(end, -7)),
      ctx,
      list: suggestions(a, ctx),
      dt: t.dt,
    }
  }, [meals, date, sex, diet, t.dt])
}

/** This week's reminder text, read straight from the stores. */
export function currentReminderCopy(meals = useNutrition.getState().meals) {
  const p = useProfile.getState()
  const S = useTraining.getState().S
  const d = today()
  const dt = dayTargets(targetsFor(p, S, useGoal.getState(), meals, d), isTrainingDay(S, d))
  const a = weekAnalysis(meals, addDays(d, -1))
  return reminderCopy(suggestions(a, suggestContext(p.sex, p.diet, dt.kcal, dt.protein)))
}

/** Keeps the meal reminders carrying this week's suggestions as the log changes (Android). */
export function useSmartReminders() {
  const hydrated = useUi((s) => s.hydrated)
  const meals = useNutrition((s) => s.meals)
  const on = useSettings((s) => s.mealReminders)
  const times = useSettings((s) => s.mealTimes)
  const last = useRef('')
  useEffect(() => {
    if (!on) last.current = ''
    if (!hydrated || !on || !isNative()) return
    const id = setTimeout(() => {
      const copy = currentReminderCopy(meals)
      const key = JSON.stringify([times, copy])
      if (key === last.current) return
      last.current = key
      void scheduleMealReminders(true, times, copy)
    }, 2000)
    return () => clearTimeout(id)
  }, [hydrated, on, times, meals])
}
