# Bridge Runs — Design Spec

**Date:** 2026-03-16
**Status:** Approved

## Problem

When a user generates a plan on any day that isn't Monday, the structured plan starts the following Monday. The gap between today and that Monday is dead air — no runs are scheduled even if the user has selected running days that fall in that window.

If the user generates on a Monday, the plan already starts today and there is no gap.

## Solution

After the AI stream completes, programmatically generate easy "bridge" runs for every selected running day between today (inclusive) and the Monday plan start (exclusive). These are merged into the plan's `days` array before final state is set and before the plan is saved.

## Scope

- New file: `packages/ai/src/bridge-runs.ts`
- New file: `packages/ai/src/bridge-runs.test.ts`
- Modified file: `apps/web/app/plan/page.tsx`
- Modified file: `packages/ai/src/index.ts` — export `buildBridgeRuns`
- Modified file: `packages/ai/src/race-prompt.ts` — export `firstMondayOnOrAfter`; update to import `STARTING_VOLUME_KM` from `constants.ts`
- New file: `packages/ai/src/constants.ts` — extract `STARTING_VOLUME_KM` from `race-prompt.ts`
- No AI prompt changes, no API changes, no DB schema changes

---

## Shared Constants (`packages/ai/src/constants.ts`)

```ts
export const STARTING_VOLUME_KM: Record<string, number> = {
  "under-40": 30,
  "40-60":    50,
  "60-80":    70,
  "80-plus":  90,
}
```

`race-prompt.ts` must **remove its own `STARTING_VOLUME_KM` declaration** and import from `constants.ts` instead. `bridge-runs.ts` also imports from `constants.ts`. Do not duplicate.

---

## Bridge Run Generation (`buildBridgeRuns`)

**Signature:**
```ts
export function buildBridgeRuns(
  input: PlanGenerationInput,
  planDays: WorkoutDay[],
  today: Date,
): WorkoutDay[]
```

**Helpers (local to `bridge-runs.ts`):**
```ts
function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const DAY_KEY_TO_UTC: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}
```

**`selectedDays` semantics:** `input.selectedDays` contains only running days (not strength days — those are in `input.strengthDays`). Using `.length` as the denominator for distance fallback is correct.

**`firstMondayOnOrAfter` contract:** Returns the input date unchanged when the input is already a Monday. After this change it is exported from `race-prompt.ts`.

---

**Full implementation pseudocode (shows exact patterns to use):**

```ts
// bridge-runs.ts — top of file imports
import { firstMondayOnOrAfter } from "./race-prompt"  // import, never re-implement locally
import { STARTING_VOLUME_KM } from "./constants"
import type { PlanGenerationInput, WorkoutDay } from "./types"

export function buildBridgeRuns(
  input: PlanGenerationInput,
  planDays: WorkoutDay[],
  today: Date,
): WorkoutDay[] {
  // 1. UTC-normalize today — do not mutate the original
  const todayUTC = new Date(today)
  todayUTC.setUTCHours(0, 0, 0, 0)

  // 2. Find plan start (first Monday on or after today)
  const planStart = firstMondayOnOrAfter(todayUTC)

  // 3. No gap if today is already at or past plan start
  //    (planStart can never be before todayUTC, so > 0 means a real gap exists)
  if (planStart.getTime() - todayUTC.getTime() <= 0) return []

  // 4. Build set of selected UTC day-of-week values
  const selectedUTCDays = new Set(
    input.selectedDays.map(d => DAY_KEY_TO_UTC[d]).filter((n): n is number => n !== undefined)
  )

  // 5. Compute week-1 date range strings for comparison
  //    planDays always starts on planStart, so d.date >= planStartISO is always true —
  //    kept for clarity; d.date <= planEndWeek1ISO does the meaningful filtering.
  const planStartISO = toISO(planStart)
  const planEndWeek1 = new Date(planStart)
  planEndWeek1.setUTCDate(planStart.getUTCDate() + 6)
  const planEndWeek1ISO = toISO(planEndWeek1)

  // 6. Find week-1 easy runs (ISO string comparison)
  const week1EasyRuns = planDays.filter(
    d => d.type === "easy" && d.date >= planStartISO && d.date <= planEndWeek1ISO && d.distanceKm !== undefined
  )

  // 7. Compute distance
  //    Fallback denominator = input.selectedDays.length = running days per week (not gap days)
  const distanceKm = week1EasyRuns.length > 0
    ? Math.round(
        week1EasyRuns.reduce((sum, d) => sum + d.distanceKm!, 0) / week1EasyRuns.length * 10
      ) / 10
    : Math.round(
        (STARTING_VOLUME_KM[input.weeklyMileageRange] ?? 50) / input.selectedDays.length * 10
      ) / 10

  // 8. Target pace — omit key entirely if not available
  const targetPace = week1EasyRuns.find(d => d.targetPace != null)?.targetPace

  // 9. Iterate gap — todayUTC is fixed; cursor is a separate mutable copy
  const results: WorkoutDay[] = []
  const cursor = new Date(todayUTC)
  while (cursor.getTime() < planStart.getTime()) {
    if (selectedUTCDays.has(cursor.getUTCDay())) {
      results.push({
        date: toISO(cursor),
        type: "easy",
        distanceKm,
        ...(targetPace !== undefined && { targetPace }),  // omit key if undefined
        description: "Easy run — pre-plan bridge day.",
      })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return results
}
```

---

## Integration (`plan/page.tsx`)

Inside `async function stream()`, declare `const localDays: WorkoutDay[] = []` **before the `while (true)` loop** (inside `stream()`, not at component scope — component-scope would persist across re-renders). Every parsed `WorkoutDay` is pushed to `localDays` alongside the `setPlan` call. This avoids any reliance on `planRef.current` (which syncs via `useEffect` and lags by one render).

In the `done` branch:

```ts
if (done) {
  if (totalWeeksRef.current === 0 || dayCountRef.current === 0) {
    setStatus("error")
  } else {
    const bridgeDays = buildBridgeRuns(mapped, localDays, new Date())
    if (bridgeDays.length > 0) {
      const mergedDays = [...bridgeDays, ...localDays].sort(
        (a, b) => a.date.localeCompare(b.date)
      )
      // Recompute totalKm from scratch — replaces (does not add to) the running
      // total accumulated during streaming.
      const newTotalKm = mergedDays.reduce((sum, d) => sum + (d.distanceKm ?? 0), 0)
      setPlan((p) => ({ ...p, days: mergedDays, totalKm: newTotalKm }))
    }
    setStatus("complete")
  }
  break
}
```

**`totalKm` note:** the `setPlan` call replaces `days` and `totalKm` entirely. It does not add bridge distances on top of a running total — the final `newTotalKm` is computed fresh from `mergedDays`. `peakWeekKm` and `totalWeeks` from the plan's `_meta` line are preserved via `...p`.

**Snapshot save correctness:** The plan is saved via `handleSave` on user interaction after the stream completes. `handleSave` reads `planRef.current`, which by that point includes the merged bridge runs (React has rendered). The pre-OAuth `handleBeforeSignIn` snapshot is also taken post-stream. No special handling needed.

---

## Tests (`packages/ai/src/bridge-runs.test.ts`)

| Test | Setup | Expected |
|------|-------|----------|
| Today is Monday | `today` = any Monday | Returns `[]` |
| Selected day not in gap | `selectedDays: ["mon"]`, today = Tuesday | Returns `[]` (gap is Tue–Sun, no Monday) |
| One bridge run | `selectedDays: ["wed"]`, today = Wednesday | 1 run on Wednesday |
| Multiple bridge runs | `selectedDays: ["wed", "fri"]`, today = Wednesday | 2 runs: Wednesday + Friday |
| Distance from week-1 easy runs | planDays has 2 week-1 easy runs: 10 km + 12 km | `distanceKm = 11.0` |
| Fallback distance | No week-1 easy runs; `weeklyMileageRange: "40-60"`, 3 selected days | `distanceKm = 16.7` (50/3 rounded to 1 decimal) |
| targetPace copied | Week-1 easy run has `targetPace: "5:30–6:00/km"` | Bridge run has same `targetPace` |
| targetPace omitted | No week-1 easy run with targetPace | `"targetPace" in run === false` |
| Today is Sunday, Sunday selected | `selectedDays: ["sun"]`, today = Sunday | 1 run on Sunday |
| Today is Sunday, Sunday not selected | `selectedDays: ["mon", "wed"]`, today = Sunday | Returns `[]` |

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Today is Monday | Returns `[]`, plan unchanged |
| Today is Tuesday | Up to 6-day gap (Tue–Sun); selected running days only |
| Today is Saturday | Up to 2-day gap (Sat–Sun); selected running days only |
| Today is Sunday | 1-day gap; run added only if Sunday is selected |
| No selected days in gap | Returns `[]` |
| Week 1 has no easy runs | Falls back to mileage-range / running-day-count heuristic |
| Stream errors | Bridge logic not reached; error state unchanged |
| Post-OAuth snapshot | Bridge runs already in snapshot; no re-computation |

---

## What This Does Not Change

- The AI prompt and plan generation are unmodified
- Week numbering, phase schedule, and `totalWeeks` are unaffected
- The DB schema is unchanged — bridge runs are stored as ordinary `WorkoutDay` rows
- `peakWeekKm` is unaffected (bridge week volume is always ≤ week-1 volume, which is always < peak)
