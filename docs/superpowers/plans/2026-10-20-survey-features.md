# Survey-driven features + "Pahel" demo profile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the four gaps the class survey flags (micronutrients, meal reminders, food groups,
meal-pattern insights) and make the demo profile "Pahel", for a nutrition-class presentation.

**Architecture:** Pure maths and data go in `packages/nutrition` (new `micros.ts`, `patterns.ts`),
tested with vitest. Micronutrients are looked up from the item's `foodId` at read time, so stored
meals and seed data need no migration. UI: one new card on the Food screen, one new route
`/food/nutrients`, and a Meal reminders block in Settings. Reminders go through the existing
`platform/notifications.ts` adapter.

**Tech Stack:** Next.js 16 static export, React, Zustand, Capacitor Local Notifications, vitest, Biome.

**Spec:** the design below (agreed in chat on 2026-10-20) plus the survey workbook
`Nutrition_Survey_35_Synthetic_Responses.xlsx` (sheets "Syntropy Feature Mapping", "Feature Priority").

## Design (agreed in chat)

- **Why:** a live demo in a nutrition class. Photo scan of a thali stays the headline; the new
  features answer survey gaps: P12 micronutrient worry (51%), P13 fruit/veg, P14/P15 irregular
  timing and skipped breakfast, E2 #12 meal reminders (the two "Build" rows of Feature Priority).
- **Micronutrients:** fibre (g), iron (mg), calcium (mg), vitamin B12 (µg), vitamin D (µg) per day
  against ICMR-NIN 2020 adult targets. Values are per 100 g estimates (IFCT 2017 / USDA) by
  food category with per-food overrides for common foods. Items with no table match are counted as
  "not estimated" and the coverage is shown, never hidden.
- **Food groups:** five groups from the survey's "balanced meal" wording: Cereals, Dal & protein,
  Vegetables, Fruit, Dairy. A food can be in several groups.
- **Meal reminders:** breakfast / lunch / dinner at editable times (defaults 08:30, 13:00, 20:00),
  plus "Send a test reminder" so it can be shown live. Native only; on web, the test uses the
  browser Notification API, else a toast.
- **Meal patterns (last 7 days):** breakfast logged on N of 7 days, the time spread per main meal,
  fruit days, vegetable days, extras per day, each with one calm sentence.
- **Rename:** the sample profile name becomes "Pahel" (initials, greetings and coach use the
  profile name). Licence notices, the source-code link, package ids and tests keep the original
  author (AGPL attribution).
- **Non-goals:** no survey statistics inside the app (the data set is synthetic); no changes to
  training screens; no new AI calls; no per-item micronutrient editing.

## Global Constraints

- Biome style: single quotes, no semicolons, 2 spaces, width 100. `pnpm lint` passes.
- Tone is calm and non-judgmental: no red, no "warning" words for low values.
- Colours: sage `#A9C3A0` for nutrition bars and lit groups; existing glass cards and `ProgressBar`.
- Every screen is a client component; ids/dates in the query string (`/food/nutrients/?d=`).
- Native access only through `apps/app/src/platform/*` with a web fallback.
- Targets (ICMR-NIN 2020 RDA, adults): iron 19 mg (male) / 29 mg (female); calcium 1000 mg;
  vitamin B12 2.5 µg; vitamin D 15 µg (600 IU); fibre 15 g per 1000 kcal of the day's target.

## Review Focus

1. Item with no `foodId` (photo item the AI named freely, custom food) → excluded from totals and
   counted in coverage; name-matched only at score ≥ 0.75. Test in Task 1.
2. Item logged in `g`/`ml` units → grams = qty, not `gramsPerUnit × qty`. Test in Task 1.
3. A day with no meals at all → not counted as "breakfast skipped"; patterns over zero logged days
   return `null` rows, and the UI shows "Log a few days to see patterns". Test in Task 2.
4. A slot logged only once in the window → spread is `null`, not 0. Test in Task 2.
5. Reminder times edited while reminders are on → old notifications are cancelled and the new
   times scheduled. Covered by `scheduleMealReminders` always cancelling first (Task 3).

---

### Task 1: Micronutrient and food-group data + maths

**Files:**
- Create: `packages/nutrition/src/micros.ts`
- Modify: `packages/nutrition/src/index.ts` (add `export * from './micros'`)
- Test: `packages/nutrition/src/micros.test.ts`

**Interfaces:**
- Produces:
  - `type Micros = { fibre: number; iron: number; calcium: number; b12: number; vitD: number }`
  - `type FoodGroup = 'cereal' | 'protein' | 'veg' | 'fruit' | 'dairy'`
  - `const MICRO_KEYS: (keyof Micros)[]`, `const MICRO_INFO: Record<keyof Micros, { name: string; unit: 'g' | 'mg' | 'µg' }>`
  - `const GROUP_INFO: Record<FoodGroup, { name: string; tip: string }>`, `const FOOD_GROUPS: FoodGroup[]`
  - `foodMicros(food: Food): Micros` (per 100 g), `foodGroups(food: Food): FoodGroup[]`
  - `itemMicros(it: MealItem): Micros | null`
  - `dayMicros(meals: Meal[]): { total: Micros; estimated: number; items: number; top: Record<keyof Micros, string[]> }`
  - `dayGroups(meals: Meal[]): Set<FoodGroup>`
  - `microTargets(sex: Sex, kcalTarget: number): Micros`

- [ ] **Step 1: Write failing tests** in `micros.test.ts`:
  - `itemMicros` of 2 roti (`itemFromFood(FOOD_BY_ID.roti, 2, 'manual')`) equals `foodMicros(roti)` scaled by 80/100 (fibre within 0.01).
  - Every food in `FOODS` returns finite, non-negative `foodMicros` values.
  - `itemMicros` returns `null` for `{ ...item, foodId: undefined, name: 'grandma special xyz' }`.
  - `itemMicros` for an item with `unit: 'g', qty: 200, foodId: 'rice'` uses 200 g.
  - `dayGroups` of a meal with `rajma-chawal` and `dahi` contains `cereal`, `protein`, `dairy` and not `fruit`.
  - `dayMicros` with one known and one unknown item → `items: 2, estimated: 1`; `top.calcium[0]` is `'Dahi'` for a dahi + rice day.
  - `microTargets('female', 2000)` → `{ fibre: 30, iron: 29, calcium: 1000, b12: 2.5, vitD: 15 }`; male iron 19.

- [ ] **Step 2: Run** `pnpm --filter @syntropy/nutrition test` → FAIL (module missing).

- [ ] **Step 3: Implement `micros.ts`.** Category defaults per 100 g for all 21 `FoodCategory`
  values plus an override map keyed by food id for common foods (roti family, millet rotis,
  rajma/chole/dal plates, palak and paneer dishes, eggs, fish, mutton, salmon, tuna, milk, dahi,
  whey, soya, tofu, nuts, roasted chana, guava, dates, spinach, broccoli, fortified plant milks).
  Groups: category default plus id overrides for mixed dishes. `itemMicros`: `foodId` →
  `FOOD_BY_ID`, else `matchFood(name, 0.75)`; grams = qty for `g`/`ml`, else `gramsPerUnit × qty`.
  `top`: up to 3 item names per nutrient by contribution, de-duplicated.

- [ ] **Step 4: Run** the tests → PASS. Run `pnpm --filter @syntropy/nutrition typecheck` → no errors.

### Task 2: Meal-pattern maths

**Files:**
- Create: `packages/nutrition/src/patterns.ts`
- Modify: `packages/nutrition/src/index.ts`
- Test: `packages/nutrition/src/patterns.test.ts`

**Interfaces:**
- Consumes: `dayGroups` (Task 1).
- Produces:
  - `interface MealPatterns { window: string[]; logged: number; breakfast: number | null; spread: Record<'breakfast' | 'lunch' | 'dinner', number | null>; fruitDays: number | null; vegDays: number | null; extrasPerDay: number | null }`
    (`spread` in minutes; counts are over `logged` days; `null` when `logged === 0`)
  - `mealPatterns(meals: Meal[], end: string, days?: number): MealPatterns` (default 7, window ends on `end` inclusive)
  - `patternNotes(p: MealPatterns): string[]` (calm one-liners, at most 3)
  - `fmtSpread(min: number): string` → `"45 min"`, `"2 h 10 min"`, `"3 h"`

- [ ] **Step 1: Failing tests:** 7 days with breakfast on 4 days and meals on all 7 → `logged 7, breakfast 4`;
  a day with no meals is not counted; lunch at 12:30 and 14:40 → `spread.lunch === 130`;
  lunch on one day only → `spread.lunch === null`; zero meals → all counts `null`;
  `fmtSpread(130) === '2 h 10 min'`; `patternNotes` with breakfast 3/7 includes a string containing `'breakfast'`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (date shift via `Date` at T12:00 like `apps/app/src/lib/dates.ts`). **Step 4:** Run → PASS.

### Task 3: Meal reminders (platform + store + Settings)

**Files:**
- Modify: `apps/app/src/platform/notifications.ts` — add `MEAL_BASE = 5200`,
  `scheduleMealReminders(on: boolean, times: MealTimes): Promise<void>` (always cancels ids 5200–5202 first; titles "Breakfast", "Lunch", "Dinner"; body e.g. "Had lunch? Snap your plate or add it in a tap."; channel `reminders`),
  `sendTestReminder(): Promise<'native' | 'web' | 'none'>` (native: schedule id 5299 in 5 s; web: `Notification` if granted/grantable).
- Modify: `apps/app/src/stores/settings.ts` — `type MealTimes = { breakfast: string; lunch: string; dinner: string }` (`'HH:MM'`), fields `mealReminders: boolean` (false), `mealTimes: MealTimes` (`08:30`, `13:00`, `20:00`).
- Modify: `apps/app/src/screens/settings/Settings.tsx` — in "Daily", after Water reminders: `ListRow` "Meal reminders" with `Switch`; when on, a `GlassCard` with three labelled `<input type="time">` and a ghost `PillButton` "Send a test reminder". Toggle mirrors `toggleReminders` (permission → toast "Reminders work in the Android app" on web).
- Verification: `pnpm --filter @syntropy/app typecheck`; screenshot `/settings/`.

### Task 4: Food screen card + Nutrients screen

**Files:**
- Create: `apps/app/src/screens/nutrition/Nutrients.tsx` (`NutrientsScreen`)
- Create: `apps/app/src/app/food/nutrients/page.tsx` (Suspense wrapper like `food/history/page.tsx`)
- Modify: `apps/app/src/screens/nutrition/FoodLog.tsx` — `BeyondCard` between the calories card and the Water card.

**Interfaces:** consumes `dayMicros`, `dayGroups`, `microTargets`, `mealPatterns`, `patternNotes`, `fmtSpread`, `GROUP_INFO`, `MICRO_INFO`; `useToday(date)` (`t.meals`, `t.dt.kcal`); `useProfile().sex`; `useNutrition().meals`.

- `BeyondCard` (links to `/food/nutrients/?d=<date>`): title "Beyond calories", kicker `NUTRIENTS ›`;
  a row of five group chips (lit sage when eaten); three mini bars: Fibre, Iron, Calcium as `value/target unit`.
- `NutrientsScreen`: `ModalHeader` "Nutrients" (sub = `kickerDate(date)`), then three cards:
  1. **Food groups** — chips + "`n` of 5 groups today" + the `GROUP_INFO.tip` of the first missing group.
  2. **Vitamins & minerals** — a row per micro: name, `value / target unit`, sage `ProgressBar`, "Mostly from …" (`top`); footer "Estimated from `estimated` of `items` items · IFCT 2017 & USDA, approximate"; vitamin D note "Sunlight is the main source of vitamin D."
  3. **Your patterns · last 7 days** — Breakfast `n of 7 days`, Lunch/Dinner time spread, Fruit days, Vegetable days, Extras per day; then `patternNotes`. If `logged === 0`: "Log a few days to see patterns."
- Verification: typecheck; screenshots of `/food/` and `/food/nutrients/` at 390×844 with sample data.

### Task 5: "Pahel" sample profile + demo-worthy seed

**Files:** Modify `apps/app/src/lib/seed.ts`.
- `name: 'Pahel'`; update the header comment.
- Past days: skip breakfast on ~30% of days and jitter breakfast/lunch times by up to ±80 min
  (deterministic via the existing `rng`), so the patterns card has something to say; keep today's meals as they are.
- Verification: `pnpm --filter @syntropy/app test`, screenshots of `/` and `/food/nutrients/`.

### Task 6: Full verification

- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` all pass (report any pre-existing failures separately).
- [ ] Build the web demo, load sample data, screenshot Home, Food, Nutrients, Settings; check text fits at 360 px.
