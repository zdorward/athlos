# Scheduler Fixes, Shakeout Type, and Race Day Enhancements

**Date:** 2026-03-17
**Status:** Approved

---

## Overview

Three independent areas of change:

1. **Scheduler bug fixes** — three confirmed bugs plus one investigation item in the workout scheduling engine that produce scientifically incorrect plans
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

### Investigation — Taper quality session count

**File:** `packages/plan-engine/src/workout-scheduler.ts` and wherever `computePhases` is defined

**Symptom:** Taper W1 in some generated plans shows two quality sessions (Race Pace + Tempo) instead of the one allowed by `PHASE_CONFIG["Taper"].first.normal = { sessions: 1, types: ["tempo"] }`.

**Root cause is unconfirmed.** Candidate causes:
- `computePhases` sets a `startWeek` for Taper that does not match what the scheduler's `phaseForWeek` lookup returns for that week number, causing the week to be classified as Peak rather than Taper
- `isRecovery` evaluation at the taper boundary interacts unexpectedly with `getQualityConfig`
- Off-by-one in `preTaperWeeks` that shifts which week is treated as the last Peak week

**Action during implementation:** Add logging or a test fixture to confirm which `phase` and `getQualityConfig` result the scheduler resolves for taper W1. Trace from `computePhases` output through `phaseForWeek` and `getQualityConfig` until the source of the extra session is identified, then fix at the source.

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
- Applies always, regardless of whether the pre-race day is in the user's selected training days — a shakeout the day before the race is universal coaching practice and should not be gated on configured training days

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
| `packages/plan-engine/src/workout-scheduler.ts` | Fix quality adjacency (Bug 1), strength adjacency (Bug 2), shakeout scheduling, fix taper quality session count (investigation item) |
| `apps/web/app/api/generate-plan/route.ts` | Add `targetPace` and `targetHR` to race entry |
| `apps/web/app/plan/workout-utils.ts` | Add shakeout to all lookup functions, update race `getWorkoutNote` and `getHRZone` |

---

## Out of Scope

- No changes to the database schema — `targetHR` and `targetPace` already exist as optional fields on `WorkoutDay`
- No UI component changes — the detail view already renders `targetHR` and `targetPace` when present
- No changes to the `medium-long` workout type or any other scheduling logic beyond what is described above
