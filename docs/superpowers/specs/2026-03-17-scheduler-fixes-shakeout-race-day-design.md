# Scheduler Fixes, Shakeout Type, and Race Day Enhancements

**Date:** 2026-03-17
**Status:** Approved

---

## Overview

Three independent areas of change:

1. **Scheduler bug fixes** — four bugs in the workout scheduling engine that produce scientifically incorrect plans
2. **Shakeout workout type** — new type scheduled the day before the race, replacing the forced rest day
3. **Race day enhancements** — populate `targetHR`, `targetPace`, and improve the description note for race entries

---

## 1. Scheduler Bug Fixes

### Bug 1 — Quality sessions too close to the long run

**File:** `packages/plan-engine/src/workout-scheduler.ts`

**Problem:** The quality candidate filter uses `!isAdjacentTo(dayKey, longRunDay)`, which only blocks days with a circular distance of exactly 1. With a Sunday long run, Tuesday tempo is permitted — only one easy day (Monday) separates them. The science doc requires at least 2 easy days on each side of the long run.

**Fix:** Replace `!isAdjacentTo(dayKey, longRunDay)` with:
```ts
circularDist(DAY_INDEX[dayKey]!, DAY_INDEX[longRunDay]!) > 2
```
This enforces a minimum gap of 3 slots (2 easy days on each side). With a Sunday long run, only Wednesday and Thursday are valid quality days in a typical Mon–Sun week.

---

### Bug 2 — Strength sessions adjacent to quality sessions

**File:** `packages/plan-engine/src/workout-scheduler.ts`

**Problem:** The strength candidate filter (line ~314) only excludes days adjacent to the long run day. It does not check adjacency to quality sessions. Wednesday strength after Tuesday tempo is a systematic violation throughout every plan.

**Fix:** After placing quality sessions, collect their day keys. Add to the strength candidate filter:
```ts
qualityDays.every(qDay => !isAdjacentTo(dayKey, qDay))
```
Strength remains on easy-run days, non-adjacent to both the long run and any quality session.

---

### Bug 3 — Taper volume does not reduce from actual peak

**File:** `packages/plan-engine/src/volume-progression.ts`

**Problem:** Taper week volumes are computed as `peakWeeklyKm * pct` (0.8, 0.6, 0.4), where `peakWeeklyKm` is the configured target mileage for the plan. The plan's linear interpolation may not reach this target before taper begins. When the configured target exceeds what the plan actually achieves, taper week 1 ends up at or above the actual last peak week rather than below it.

**Fix:** Compute the actual last pre-taper week volume at `t = 1.0` in the linear interpolation (without the recovery dip). Store this as `actualPeakVol` and use it as the reduction base:
```ts
const actualPeakVol = startVol + (peakWeeklyKm - startVol) * 1.0
// For taper weeks:
volume = actualPeakVol * pct
```
This guarantees taper week 1 is genuinely lower than the week the runner just completed.

---

### Bug 4 — Taper quality session count

**File:** `packages/plan-engine/src/workout-scheduler.ts` and `packages/plan-engine/src/pace-calculator.ts` (wherever `computePhases` lives)

**Problem:** Taper W1 in some generated plans shows two quality sessions (Race Pace + Tempo) instead of the one allowed by `PHASE_CONFIG["Taper"].first.normal`. This likely follows from Bug 3 — if the taper phase `startWeek` is misaligned with the volume reduction, the scheduler may treat taper weeks as peak weeks.

**Fix:** After fixing Bug 3, verify that `computePhases` sets `startWeek` for Taper consistently with what `computeWeeklyVolumes` uses for `taperPhase.startWeek`. Confirm `PHASE_CONFIG["Taper"].first.normal = { sessions: 1, types: ["tempo"] }` is correctly applied.

---

## 2. Shakeout Workout Type

### Type definition

Add `"shakeout"` to the `WorkoutType` union in `packages/plan-engine/src/types.ts`:
```ts
export type WorkoutType =
  | "easy"
  | "long"
  | "progression"
  | "medium-long"
  | "mp"
  | "tempo"
  | "intervals"
  | "rest"
  | "race"
  | "strength"
  | "shakeout"
```

### Scheduling

**File:** `packages/plan-engine/src/workout-scheduler.ts`

In the race week block, the pre-race day (day before the race date) is currently forced to rest. Replace with a shakeout entry:

```ts
{
  date: preRaceDate,
  type: "shakeout",
  distanceKm: 5,
  targetPace: paceZones.easy,
}
```

- Distance: 5 km fixed — short enough to avoid fatigue, long enough to feel purposeful
- Pace: easy pace (`paceZones.easy`)
- No strength session
- Applies always, regardless of whether the pre-race day is in the user's selected training days

### UI constants (`apps/web/app/plan/workout-utils.ts`)

| Field | Value |
|-------|-------|
| `WORKOUT_NAMES` | `"Shakeout"` |
| `WORKOUT_TEXT_CLASS` | `"text-muted-foreground"` (same as easy — Zone 1 effort) |
| `getWorkoutColor` | No entry needed (uses Tailwind class) |
| `getWorkoutNote` | `"Short shakeout to activate your legs. Keep it easy — you're not training today."` |
| `getHRZone` | `"Zone 1"` |

`targetPace` is set at generation time via `paceZones.easy` on the `WorkoutDay`. No separate `getTargetPace` lookup needed.

---

## 3. Race Day Enhancements

### Where race entries are created

Race `WorkoutDay` entries are appended in `apps/web/app/api/generate-plan/route.ts` after the scheduler runs. Currently only `date`, `type: "race"`, and `distanceKm` are set.

### Fields to add

```ts
{
  date: raceDateISO,
  type: "race",
  distanceKm: raceDistanceKm,        // already set
  targetPace: paceZones.mp,           // ADD: goal marathon pace
  targetHR: "Zone 3",                 // ADD: sustained marathon effort
}
```

- `targetPace`: `paceZones.mp` is already computed from the runner's goal time — this is exactly the pace they are targeting
- `targetHR`: `"Zone 3"` — marathon effort is sustained threshold, same zone as `mp` workouts

### `getWorkoutNote` update (`apps/web/app/plan/workout-utils.ts`)

```ts
case "race":
  return "Race day. Start conservative — first half at goal pace, finish strong if you have it."
```

### `getHRZone` update (`apps/web/app/plan/workout-utils.ts`)

Change `race` from `"—"` to `"Zone 3"` to match the populated `targetHR` field and display correctly in the detail view.

---

## Files Changed

| File | Change |
|------|--------|
| `packages/plan-engine/src/types.ts` | Add `"shakeout"` to `WorkoutType` |
| `packages/plan-engine/src/volume-progression.ts` | Fix taper base volume (Bug 3) |
| `packages/plan-engine/src/workout-scheduler.ts` | Fix quality adjacency (Bug 1), strength adjacency (Bug 2), shakeout scheduling, verify taper phase alignment (Bug 4) |
| `apps/web/app/api/generate-plan/route.ts` | Add `targetPace` and `targetHR` to race entry |
| `apps/web/app/plan/workout-utils.ts` | Add shakeout to all lookup functions, update race `getWorkoutNote` and `getHRZone` |

---

## Out of Scope

- No changes to the database schema — `targetHR` and `targetPace` already exist as optional fields on `WorkoutDay`
- No UI component changes — the detail view already renders `targetHR` and `targetPace` when present
- No changes to the `medium-long` workout type or any other scheduling logic beyond what is described above
