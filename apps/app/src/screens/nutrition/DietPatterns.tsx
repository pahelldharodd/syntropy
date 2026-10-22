'use client'

import {
  DIET_PATTERNS,
  FOOD_GROUPS,
  GROUP_INFO,
  type Meal,
  MICRO_KEYS,
  type Micros,
  type PatternId,
  type Suggestion,
  type WeekAnalysis,
  weekCsv,
} from '@syntropy/nutrition'
import { GlassCard, Icon, IconButton, Kicker, PillButton, ProgressBar, Screen } from '@syntropy/ui'
import { useRouter, useSearchParams } from 'next/navigation'
import { ModalHeader } from '@/components/BottomBar'
import { fmt, parseIso, shortDate, today } from '@/lib/dates'
import { useWeekAnalysis } from '@/lib/dietPatterns'
import { exportText } from '@/platform/files'
import { toast, useNutrition } from '@/stores'
import { MicroBar } from './Nutrients'

const SAGE = '#A9C3A0'
const PEACH = '#FFC7B0'
const FAT = '#FF8A5C'
const DIM = 'rgba(243,241,236,0.55)'
const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const PATTERN_ORDER: PatternId[] = ['processed', 'fruit-veg', 'irregular', 'mixed']

const cardStyle = { display: 'flex', flexDirection: 'column', gap: 12 } as const

function CardHead({ title, note }: { title: string; note?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 15 }}>{title}</span>
      {note ? (
        <span className="sy-mono" style={{ fontSize: 10.5, color: DIM }}>
          {note}
        </span>
      ) : null}
    </div>
  )
}

/** The survey pattern this week falls into, and why. */
function PatternCard({ a }: { a: WeekAnalysis }) {
  const p = a.pattern
  return (
    <GlassCard
      as="section"
      aria-label="Your dietary pattern"
      padding={18}
      radius={24}
      style={cardStyle}
    >
      <Kicker color={SAGE}>Your pattern · last 7 days</Kicker>
      <h2 style={{ margin: 0, fontSize: 26, fontWeight: 300, lineHeight: 1.15 }}>
        {p ? p.name : 'Not enough days yet'}
      </h2>
      {p ? (
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: 13,
            lineHeight: 1.5,
            color: 'rgba(243,241,236,0.78)',
          }}
        >
          {p.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(243,241,236,0.7)' }}>
          Log at least 3 days to see your pattern. {a.logged} of 7 so far.
        </p>
      )}
      <ul
        aria-label="The four patterns"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          margin: 0,
          padding: 0,
          listStyle: 'none',
        }}
      >
        {PATTERN_ORDER.map((id) => {
          const on = p?.id === id
          return (
            <li
              key={id}
              aria-current={on ? 'true' : undefined}
              style={{
                height: 26,
                lineHeight: '24px',
                padding: '0 10px',
                borderRadius: 13,
                fontSize: 11,
                border: `1px solid ${on ? 'rgba(169,195,160,0.6)' : 'rgba(255,255,255,0.1)'}`,
                background: on ? 'rgba(169,195,160,0.18)' : 'transparent',
                color: on ? '#DCE8D6' : 'rgba(243,241,236,0.45)',
                whiteSpace: 'nowrap',
              }}
            >
              {DIET_PATTERNS[id].name}
            </li>
          )
        })}
      </ul>
      <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(243,241,236,0.5)', lineHeight: 1.45 }}>
        The same four rules as our survey, applied to what you logged.
      </p>
    </GlassCard>
  )
}

function SuggestionBody({ s }: { s: Suggestion }) {
  return (
    <>
      <span style={{ fontSize: 15.5 }}>{s.title}</span>
      <span style={{ fontSize: 12.5, color: DIM }}>{s.evidence}</span>
      <span style={{ fontSize: 13.5, lineHeight: 1.45, color: 'rgba(243,241,236,0.88)' }}>
        {s.action}
      </span>
    </>
  )
}

function FocusCard({ s }: { s: Suggestion }) {
  return (
    <GlassCard
      as="section"
      aria-label="Focus this week"
      padding={16}
      radius={24}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        borderLeft: `2px solid ${SAGE}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="sparkle" size={14} style={{ color: SAGE }} />
        <Kicker color={SAGE}>Focus this week</Kicker>
      </div>
      <SuggestionBody s={s} />
    </GlassCard>
  )
}

const DAY_START = 6 * 60
const DAY_SPAN = 18 * 60
const pos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${Math.max(0, Math.min(100, ((h * 60 + m - DAY_START) / DAY_SPAN) * 100))}%`
}
const median = (xs: string[]) => [...xs].sort()[Math.floor(xs.length / 2)]

function TimeDot({
  at,
  color,
  size = 10,
  hollow = false,
}: {
  at: string
  color: string
  size?: number
  hollow?: boolean
}) {
  return (
    <span
      style={{
        position: 'absolute',
        left: pos(at),
        top: '50%',
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: '50%',
        background: hollow ? 'transparent' : color,
        border: hollow ? `1.5px dashed ${color}` : 'none',
      }}
    />
  )
}

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`

/** "2.9 meals and 1.4 snacks a day · breakfast missed on 1 day · no late dinners". */
function timingSummary(a: WeekAnalysis): string {
  const { mainsPerDay, snacksPerDay, breakfastMissed, lateDinners } = a.timing
  return [
    `${mainsPerDay.toFixed(1)} meals and ${snacksPerDay.toFixed(1)} snacks a day`,
    breakfastMissed ? `breakfast missed on ${days(breakfastMissed)}` : 'breakfast every day',
    lateDinners ? `dinner after 9:30 pm on ${days(lateDinners)}` : 'no late dinners',
  ].join(' · ')
}

/** When each day's meals happened, 6:00 to midnight, one row per day. */
function TimingCard({ a, meals }: { a: WeekAnalysis; meals: Meal[] }) {
  const breakfasts = a.rows.map((r) => r.times.breakfast).filter((t): t is string => !!t)
  const usualBreakfast = breakfasts.length ? median(breakfasts) : '08:30'
  return (
    <GlassCard as="section" aria-label="Meal timing" padding={16} radius={24} style={cardStyle}>
      <CardHead title="Meal timing" note="6:00 – 24:00" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {a.rows.map((r) => {
          const snacks = meals.filter(
            (m) =>
              m.date === r.date && m.items.length && (m.slot === 'snack' || m.slot === 'extra'),
          )
          return (
            <div
              key={r.date}
              style={{ display: 'grid', gridTemplateColumns: '18px minmax(0,1fr)', gap: 8 }}
            >
              <span className="sy-mono" style={{ fontSize: 10.5, color: DIM, lineHeight: '20px' }}>
                {WD[parseIso(r.date).getDay()]}
              </span>
              <div
                role="img"
                aria-label={
                  r.logged
                    ? `${shortDate(r.date)}: breakfast ${r.times.breakfast ?? 'missed'}, lunch ${r.times.lunch ?? 'none'}, dinner ${r.times.dinner ?? 'none'}`
                    : `${shortDate(r.date)}: not logged`
                }
                style={{
                  position: 'relative',
                  height: 20,
                  borderRadius: 10,
                  background: r.logged ? 'rgba(255,255,255,0.04)' : 'transparent',
                  border: r.logged ? 'none' : '1px dashed rgba(255,255,255,0.08)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: pos('21:30'),
                    right: 0,
                    top: 0,
                    bottom: 0,
                    borderRadius: '0 10px 10px 0',
                    background: 'rgba(255,138,92,0.08)',
                  }}
                />
                {r.logged ? (
                  <>
                    {snacks.map((m) => (
                      <TimeDot key={m.id} at={m.time} color="rgba(243,241,236,0.45)" size={6} />
                    ))}
                    {r.times.breakfast ? (
                      <TimeDot at={r.times.breakfast} color={PEACH} />
                    ) : (
                      <TimeDot at={usualBreakfast} color={PEACH} hollow />
                    )}
                    {r.times.lunch ? <TimeDot at={r.times.lunch} color={SAGE} /> : null}
                    {r.times.dinner ? <TimeDot at={r.times.dinner} color="#F3F1EC" /> : null}
                  </>
                ) : null}
              </div>
            </div>
          )
        })}
        <div
          aria-hidden="true"
          className="sy-mono"
          style={{
            display: 'grid',
            gridTemplateColumns: '18px minmax(0,1fr)',
            gap: 8,
            fontSize: 9.5,
            color: 'rgba(243,241,236,0.4)',
          }}
        >
          <span />
          <span style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>6</span>
            <span>12</span>
            <span>18</span>
            <span>24</span>
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 11, color: DIM }}>
        {(
          [
            [PEACH, 'Breakfast'],
            [SAGE, 'Lunch'],
            ['#F3F1EC', 'Dinner'],
            ['rgba(243,241,236,0.45)', 'Snacks'],
          ] as const
        ).map(([c, n]) => (
          <span key={n} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: c }} />
            {n}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, border: `1.5px dashed ${PEACH}` }} />
          Missed breakfast
        </span>
      </div>
      {a.logged ? (
        <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(243,241,236,0.72)', lineHeight: 1.45 }}>
          {timingSummary(a)}
        </p>
      ) : null}
    </GlassCard>
  )
}

/** Which food groups each day had, and the mean dietary diversity. */
function GroupsCard({ a }: { a: WeekAnalysis }) {
  const head = { fontWeight: 400, padding: 0, textAlign: 'center' } as const
  return (
    <GlassCard as="section" aria-label="Food groups" padding={16} radius={24} style={cardStyle}>
      <CardHead title="Food groups" note={`${a.groups.diversity.toFixed(1)} OF 5 A DAY`} />
      <table
        aria-label="Food groups by day"
        style={{
          width: '100%',
          tableLayout: 'fixed',
          borderCollapse: 'separate',
          borderSpacing: '5px 6px',
          margin: '-6px -5px',
        }}
      >
        <colgroup>
          <col style={{ width: 96 }} />
          {a.rows.map((r) => (
            <col key={r.date} />
          ))}
          <col style={{ width: 34 }} />
        </colgroup>
        <thead className="sy-mono" style={{ fontSize: 10, color: 'rgba(243,241,236,0.45)' }}>
          <tr>
            <td />
            {a.rows.map((r) => (
              <th key={r.date} scope="col" style={head} aria-label={shortDate(r.date)}>
                {WD[parseIso(r.date).getDay()]}
              </th>
            ))}
            <th scope="col" style={{ ...head, textAlign: 'right' }}>
              DAYS
            </th>
          </tr>
        </thead>
        <tbody>
          {FOOD_GROUPS.map((g) => (
            <tr key={g}>
              <th
                scope="row"
                style={{
                  ...head,
                  textAlign: 'left',
                  fontSize: 12,
                  color: 'rgba(243,241,236,0.75)',
                  whiteSpace: 'nowrap',
                }}
              >
                {GROUP_INFO[g].name}
              </th>
              {a.rows.map((r) => (
                <td
                  key={r.date}
                  aria-label={!r.logged ? 'not logged' : r.groups[g] ? 'yes' : 'no'}
                  style={{
                    height: 18,
                    padding: 0,
                    borderRadius: 5,
                    background: r.groups[g] ? 'rgba(169,195,160,0.7)' : 'rgba(255,255,255,0.05)',
                    border: r.logged ? 'none' : '1px dashed rgba(255,255,255,0.08)',
                  }}
                />
              ))}
              <td
                className="sy-mono"
                style={{
                  padding: 0,
                  fontSize: 11,
                  textAlign: 'right',
                  color: 'rgba(243,241,236,0.7)',
                }}
              >
                {a.groups.days[g]}/{a.logged}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(243,241,236,0.5)', lineHeight: 1.45 }}>
        Dietary diversity: the number of the five groups eaten each day, averaged over the days
        logged.
      </p>
    </GlassCard>
  )
}

/** Energy, macro balance and micronutrients, averaged over the logged days. */
function IntakeCard({
  a,
  kcalTarget,
  proteinTarget,
  micros,
}: {
  a: WeekAnalysis
  kcalTarget: number
  proteinTarget: number
  micros: Micros
}) {
  const { split } = a.intake
  return (
    <GlassCard
      as="section"
      aria-label="Energy and nutrients"
      padding={16}
      radius={24}
      style={cardStyle}
    >
      <CardHead title="Energy & nutrients" note="DAILY AVERAGE" />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span className="sy-dot" style={{ fontSize: 30, lineHeight: 1 }}>
          {fmt(a.intake.kcal)}
        </span>
        <span style={{ fontSize: 12.5, color: DIM }}>
          ± {fmt(a.intake.kcalSd)} kcal · target {fmt(kcalTarget)}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          role="img"
          aria-label={`Energy from protein ${Math.round(split.protein * 100)}%, carbs ${Math.round(split.carbs * 100)}%, fat ${Math.round(split.fat * 100)}%`}
          style={{
            position: 'relative',
            display: 'flex',
            height: 8,
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <span style={{ width: `${split.protein * 100}%`, background: SAGE }} />
          <span style={{ width: `${split.carbs * 100}%`, background: PEACH }} />
          <span style={{ width: `${split.fat * 100}%`, background: FAT }} />
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: '30%',
              top: -2,
              bottom: -2,
              width: 2,
              background: 'var(--sy-void)',
            }}
          />
        </div>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: DIM }}
        >
          <span>Protein {Math.round(split.protein * 100)}%</span>
          <span>Carbs {Math.round(split.carbs * 100)}%</span>
          <span style={{ color: split.fat > 0.3 ? FAT : DIM }}>
            Fat {Math.round(split.fat * 100)}% (guide under 30%)
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'rgba(243,241,236,0.72)' }}>Protein</span>
          <span className="sy-mono" style={{ fontSize: 11, color: 'rgba(243,241,236,0.6)' }}>
            {Math.round(a.intake.macros.protein)}/{Math.round(proteinTarget)} g
          </span>
        </div>
        <ProgressBar value={a.intake.macros.protein / proteinTarget} color={SAGE} height={5} />
      </div>
      {MICRO_KEYS.map((k) => (
        <MicroBar key={k} k={k} value={a.intake.micros[k]} target={micros[k]} />
      ))}
      <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(243,241,236,0.5)', lineHeight: 1.45 }}>
        Approximate values from IFCT 2017 and USDA · targets from ICMR-NIN 2020.
      </p>
    </GlassCard>
  )
}

/** "Fruit days 2 → 4" for the measures that moved since the week before. */
function changes(a: WeekAnalysis, prev: WeekAnalysis): string[] {
  if (a.logged < 3 || prev.logged < 3) return []
  const rows: [string, number, number, number][] = [
    ['Fruit days', prev.groups.days.fruit, a.groups.days.fruit, 0],
    ['Vegetable days', prev.groups.days.veg, a.groups.days.veg, 0],
    [
      'Breakfast days',
      prev.logged - prev.timing.breakfastMissed,
      a.logged - a.timing.breakfastMissed,
      0,
    ],
    ['Food groups a day', prev.groups.diversity, a.groups.diversity, 1],
  ]
  return rows
    .filter(([, x, y, d]) => x.toFixed(d) !== y.toFixed(d))
    .map(([n, x, y, d]) => `${n} ${x.toFixed(d)} → ${y.toFixed(d)}`)
}

/** Seven days of logs as patterns, suggestions and a study export. */
export function DietPatternsScreen() {
  const router = useRouter()
  const date = useSearchParams().get('d') ?? today()
  const { end, a, prev, ctx, list, dt } = useWeekAnalysis(date)
  const meals = useNutrition((s) => s.meals)
  const moved = changes(a, prev)

  const exportWeek = async () => {
    await exportText(`syntropy-7-days-${end}.csv`, weekCsv(a), 'text/csv', 'Syntropy 7-day log')
    toast('7-day log exported')
  }

  return (
    <Screen
      orbs={[
        { tone: 'sage', strength: 0.36, size: 540, right: -260, top: -160 },
        { tone: 'peach', strength: 0.2, left: -240, bottom: -200 },
      ]}
    >
      <ModalHeader
        left={<IconButton icon="chevronLeft" label="Back" onClick={() => router.back()} />}
        title="Diet patterns"
        sub={`7 DAYS TO ${shortDate(end).toUpperCase()}`}
      />

      <PatternCard a={a} />
      {list[0] ? <FocusCard s={list[0]} /> : null}
      {a.logged ? (
        <>
          <TimingCard a={a} meals={meals} />
          <GroupsCard a={a} />
          <IntakeCard
            a={a}
            kcalTarget={dt.kcal}
            proteinTarget={ctx.proteinTarget}
            micros={ctx.micros}
          />
        </>
      ) : null}

      {list.length > 1 || moved.length ? (
        <GlassCard
          as="section"
          aria-label="More suggestions"
          padding={16}
          radius={24}
          style={cardStyle}
        >
          <CardHead title="Also worth a look" />
          {list.slice(1, 4).map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                padding: '10px 12px',
                borderRadius: 14,
                background: 'rgba(169,195,160,0.06)',
              }}
            >
              <SuggestionBody s={s} />
            </div>
          ))}
          {moved.length ? (
            <p style={{ margin: 0, fontSize: 12, color: DIM, lineHeight: 1.5 }}>
              Since the week before: {moved.join(' · ')}
            </p>
          ) : null}
        </GlassCard>
      ) : null}

      {a.logged ? (
        <PillButton variant="glass" height={48} icon="download" onClick={exportWeek}>
          Export 7 days (CSV)
        </PillButton>
      ) : null}
    </Screen>
  )
}
