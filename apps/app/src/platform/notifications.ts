'use client'

import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from './native'

const REST_ID = 4242
const WATER_BASE = 5100

export async function ensureNotifyPermission(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const s = await LocalNotifications.checkPermissions()
    if (s.display === 'granted') return true
    return (await LocalNotifications.requestPermissions()).display === 'granted'
  } catch {
    return false
  }
}

/** Rest timer: one notification when rest ends, so it works with the screen off. */
export async function scheduleRestEnd(at: number, next: string): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] })
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_ID,
          title: 'Rest is over',
          body: next,
          schedule: { at: new Date(at), allowWhileIdle: true },
          channelId: 'rest',
        },
      ],
    })
  } catch {}
}

export async function cancelRest(): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_ID }] })
  } catch {}
}

/** Gentle water reminders at fixed hours. */
export async function scheduleWaterReminders(on: boolean, hours = [10, 13, 16, 19]): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.cancel({
      notifications: hours.map((_, i) => ({ id: WATER_BASE + i })),
    })
    if (!on) return
    await LocalNotifications.schedule({
      notifications: hours.map((h, i) => ({
        id: WATER_BASE + i,
        title: 'Water',
        body: 'A glass now keeps the afternoon calm.',
        schedule: { on: { hour: h, minute: 0 }, allowWhileIdle: true },
        channelId: 'reminders',
      })),
    })
  } catch {}
}

export type MealTimes = { breakfast: string; lunch: string; dinner: string }

const MEAL_BASE = 5200
const TEST_ID = 5299
const MEAL_COPY: [keyof MealTimes, string, string][] = [
  ['breakfast', 'Breakfast', 'Had breakfast? Snap your plate or add it in a tap.'],
  ['lunch', 'Lunch', 'Had lunch? Snap your plate or add it in a tap.'],
  ['dinner', 'Dinner', 'Had dinner? A quick photo keeps today complete.'],
]

/**
 * Daily reminders to log the three main meals, at "HH:MM" times. Always replaces the old ones.
 * `copy` swaps in this week's suggestion for a meal (see `reminderCopy`).
 */
export async function scheduleMealReminders(
  on: boolean,
  times: MealTimes,
  copy: Partial<Record<keyof MealTimes, string>> = {},
): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.cancel({
      notifications: MEAL_COPY.map((_, i) => ({ id: MEAL_BASE + i })),
    })
    if (!on) return
    await LocalNotifications.schedule({
      notifications: MEAL_COPY.map(([slot, title, body], i) => {
        const [hour, minute] = times[slot].split(':').map(Number)
        return {
          id: MEAL_BASE + i,
          title,
          body: copy[slot] ?? body,
          // Android shows the full suggestion when the notification is expanded.
          largeBody: copy[slot],
          schedule: { on: { hour, minute }, allowWhileIdle: true },
          channelId: 'reminders',
        }
      }),
    })
  } catch {}
}

/** One sample lunch reminder: in 5 s on the phone, or a browser notification on the web. */
export async function sendTestReminder(lunch?: string): Promise<'native' | 'web' | 'none'> {
  const [, title, fallback] = MEAL_COPY[1]
  const body = lunch ?? fallback
  if (isNative()) {
    try {
      if (!(await ensureNotifyPermission())) return 'none'
      await LocalNotifications.schedule({
        notifications: [
          {
            id: TEST_ID,
            title,
            body,
            largeBody: body,
            schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
            channelId: 'reminders',
          },
        ],
      })
      return 'native'
    } catch {
      return 'none'
    }
  }
  try {
    if (typeof Notification === 'undefined') return 'none'
    const perm =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission
    if (perm !== 'granted') return 'none'
    new Notification(title, { body })
    return 'web'
  } catch {
    return 'none'
  }
}

export async function createChannels(): Promise<void> {
  if (!isNative()) return
  try {
    await LocalNotifications.createChannel({
      id: 'rest',
      name: 'Rest timer',
      importance: 4,
      vibration: true,
    })
    await LocalNotifications.createChannel({ id: 'reminders', name: 'Reminders', importance: 3 })
  } catch {}
}
