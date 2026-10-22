'use client'

import {
  dayGroups,
  dayMicros,
  FOOD_GROUPS,
  type FoodGroup,
  fmtSpread,
  GROUP_INFO,
  MICRO_INFO,
  MICRO_KEYS,
  type Micros,
  microTargets,
} from '@syntropy/nutrition'
import { GlassCard, IconButton, PillButton, ProgressBar, Screen } from '@syntropy/ui'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { ModalHeader } from '@/components/BottomBar'
import { kickerDate, today } from '@/lib/dates'
import { useWeekAnalysis } from '@/lib/dietPatterns'
import { useToday } from '@/lib/summary'
import { useProfile } from '@/stores'

const SAGE = '#A9C3A0'

/** "12.4 g", "640 mg", "1.8 µg". Calcium reads best without decimals. */
export function fmtMicro(k: keyof Micros, v: number): string {
  return k === 'calcium' ? String(Math.round(v)) : v < 10 ? v.toFixed(1) : String(Math.round(v))
}

/** Five food-group pills, lit when the group was eaten. */
export function GroupChips({ eaten }: { eaten: Set<FoodGroup> }) {
  return (
    <ul
      aria-label="Food groups"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        margin: 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {FOOD_GROUPS.map((g) => {
        const on = eaten.has(g)
        return (
          <li
            key={g}
            aria-label={`${GROUP_INFO[g].name}: ${on ? 'eaten' : 'not yet'}`}
            style={{
              height: 26,
              lineHeight: '24px',
              padding: '0 10px',
              borderRadius: 13,
              fontSize: 11.5,
              border: `1px solid ${on ? 'rgba(169,195,160,0.6)' : 'rgba(255,255,255,0.12)'}`,
              background: on ? 'rgba(169,195,160,0.18)' : 'rgba(255,255,255,0.03)',
              color: on ? '#DCE8D6' : 'rgba(243,241,236,0.5)',
              whiteSpace: 'nowrap',
            }}
          >
            {on ? '● ' : '○ '}
            {GROUP_INFO[g].name}
          </li>
        )
      })}
    </ul>
  )
}

/** A nutrient's name, amount against target, and a bar. `stacked` puts the amount under the name. */
export function MicroBar({
  k,
  value,
  target,
  stacked = false,
}: {
  k: keyof Micros
  value: number
  target: number
  stacked?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: stacked ? 'column' : 'row',
          justifyContent: 'space-between',
          gap: stacked ? 2 : 8,
          fontSize: 12,
        }}
      >
        <span style={{ color: 'rgba(243,241,236,0.72)' }}>{MICRO_INFO[k].name}</span>
        <span className="sy-mono" style={{ fontSize: 11, color: 'rgba(243,241,236,0.6)' }}>
          {fmtMicro(k, value)}/{fmtMicro(k, target)} {MICRO_INFO[k].unit}
        </span>
      </div>
      <ProgressBar value={value / Math.max(0.01, target)} color={SAGE} height={5} />
    </div>
  )
}

/** Micronutrients and food groups for one day, and the week's patterns (survey gaps P11–P15). */
export function NutrientsScreen() {
  const router = useRouter()
  const date = useSearchParams().get('d') ?? today()
  const t = useToday(date)
  const sex = useProfile((s) => s.sex)
  const micros = useMemo(() => dayMicros(t.meals), [t.meals])
  const groups = useMemo(() => dayGroups(t.meals), [t.meals])
  const target = microTargets(sex, t.dt.kcal)
  const { a, list } = useWeekAnalysis(date)
  const missing = FOOD_GROUPS.find((g) => !groups.has(g))
  const of = (n: number) => `${n} of ${a.logged} days`

  return (
    <Screen
      orbs={[
        { tone: 'sage', strength: 0.36, size: 540, right: -260, top: -160 },
        { tone: 'peach', strength: 0.2, left: -240, bottom: -200 },
      ]}
    >
      <ModalHeader
        left={<IconButton icon="chevronLeft" label="Back" onClick={() => router.back()} />}
        title="Nutrients"
        sub={kickerDate(date)}
      />

      <GlassCard
        as="section"
        aria-label="Food groups"
        padding={16}
        radius={24}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 15 }}>Food groups</span>
          <span className="sy-mono" style={{ fontSize: 10.5, color: 'rgba(243,241,236,0.55)' }}>
            {groups.size} OF 5 TODAY
          </span>
        </div>
        <GroupChips eaten={groups} />
        <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(243,241,236,0.65)', lineHeight: 1.45 }}>
          {missing
            ? GROUP_INFO[missing].tip
            : 'All five groups today: cereal, dal or protein, vegetables, fruit and dairy.'}
        </p>
      </GlassCard>

      <GlassCard
        as="section"
        aria-label="Vitamins and minerals"
        padding={16}
        radius={24}
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <span style={{ fontSize: 15 }}>Vitamins & minerals</span>
        {MICRO_KEYS.map((k) => (
          <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <MicroBar k={k} value={micros.total[k]} target={target[k]} />
            <span style={{ fontSize: 11.5, color: 'rgba(243,241,236,0.5)' }}>
              {micros.top[k].length ? `Mostly from ${micros.top[k].join(', ').toLowerCase()}` : '—'}
              {k === 'vitD' ? ' · Sunlight is the main source of vitamin D.' : ''}
            </span>
          </div>
        ))}
        <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(243,241,236,0.5)', lineHeight: 1.45 }}>
          Estimated from {micros.estimated} of {micros.items} items · approximate values from IFCT
          2017 and USDA · targets from ICMR-NIN 2020.
        </p>
      </GlassCard>

      <GlassCard
        as="section"
        aria-label="Your patterns, last 7 days"
        padding={16}
        radius={24}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 15 }}>Your patterns</span>
          <span className="sy-mono" style={{ fontSize: 10.5, color: 'rgba(243,241,236,0.55)' }}>
            LAST 7 DAYS
          </span>
        </div>
        {a.logged === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(243,241,236,0.6)' }}>
            Log a few days to see patterns.
          </p>
        ) : (
          <>
            {a.pattern ? (
              <span style={{ fontSize: 18, fontWeight: 300 }}>{a.pattern.name}</span>
            ) : null}
            <dl
              style={{
                margin: 0,
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) auto',
                rowGap: 8,
                columnGap: 12,
                fontSize: 13,
              }}
            >
              {(
                [
                  ['Breakfast logged', of(a.logged - a.timing.breakfastMissed)],
                  ...(['breakfast', 'lunch', 'dinner'] as const).map((s) => {
                    const sp = a.timing.spread[s]
                    return [
                      `${s[0].toUpperCase()}${s.slice(1)} time varies`,
                      sp == null ? '–' : `by ${fmtSpread(sp)}`,
                    ] as const
                  }),
                  ['Fruit', of(a.groups.days.fruit)],
                  ['Vegetables', of(a.groups.days.veg)],
                  ['Snacks and extras', `${a.timing.snacksPerDay.toFixed(1)} a day`],
                ] as const
              ).map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt style={{ color: 'rgba(243,241,236,0.65)' }}>{k}</dt>
                  <dd style={{ margin: 0, textAlign: 'right' }}>{v}</dd>
                </div>
              ))}
            </dl>
            {list[0] ? (
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  padding: '9px 12px',
                  borderRadius: 14,
                  background: 'rgba(169,195,160,0.08)',
                  borderLeft: `2px solid ${SAGE}`,
                  color: 'rgba(243,241,236,0.82)',
                }}
              >
                {list[0].evidence}. {list[0].action}
              </p>
            ) : null}
          </>
        )}
        <PillButton
          variant="glass"
          height={44}
          fontSize={13.5}
          icon="stats"
          href={date === today() ? '/food/patterns/' : `/food/patterns/?d=${date}`}
        >
          Full pattern analysis
        </PillButton>
      </GlassCard>
    </Screen>
  )
}
