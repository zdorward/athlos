# Mileage Bracket Expansion

**Date:** 2026-03-19
**Status:** Draft

---

## Problem

The current `WeeklyMileageRange` type has 4 brackets: `"under-40" | "40-60" | "60-80" | "80-plus"`. The lowest bracket groups everyone from 0 km/month through 35 km/week into one bucket. This causes two failures:

1. **Feasibility warning doesn't fire for beginners.** `WEEK1_VOLUME_KM["under-40"]` = 30 km/week is used as the starting volume for compound ramp calculations. A true beginner at 0 km/month gets an achievable peak of `30 × 1.08^17 ≈ 111 km/week` — far above the 26 km long-run threshold — so no warning fires even though their plan is deeply undersized.

2. **Plans are miscalibrated for the low end.** A first-timer at 0 km/month shouldn't start at 30 km/week. Starting there inflates training loads and hides real feasibility gaps.

3. **UI options are inadequate.** "Under 40 km/week" lumps true beginners with 35 km/week runners. Users can't accurately place themselves.

---

## Goals

- Split the low end into 3 granular brackets
- Surface accurate feasibility warnings for beginners
- Give users activity-level framing in the UI (descriptions first, km as secondary)
- Preserve all existing plan behaviour for the `"40-60"`, `"60-80"`, and `"80-plus"` brackets

---

## Non-Goals

- Changing training science principles
- Adding pace-based bracket selection
- Changing plan structure or phase layout
- Any changes to the `"40-60"`, `"60-80"`, or `"80-plus"` brackets

---

## Section 1: New Bracket Definitions

Replace `"under-40"` with three brackets:

| Value | UI Label | UI Subtext | km Range |
|---|---|---|---|
| `"0-10"` | Just getting started | Little or no current running | 0–10 km/wk |
| `"10-25"` | Occasional runner | 1–2 runs a week, mostly short | 10–25 km/wk |
| `"25-40"` | Regular runner | 3–4 days/week, comfortable up to ~10 km | 25–40 km/wk |
| `"40-60"` | Consistent runner | 4–5 days/week, regular long runs | 40–60 km/wk |
| `"60-80"` | Club runner | 5–6 days/week, comfortable at distance | 60–80 km/wk |
| `"80-plus"` | High mileage runner | 6–7 days/week, high weekly volume | 80+ km/wk |

The existing `"under-40"` bracket string is removed from the type. All code using `"under-40"` migrates to `"25-40"` (same constants — just a rename).

---

## Section 2: Plan Engine Constants

### `WeeklyMileageRange` (types.ts)

```ts
export type WeeklyMileageRange = "0-10" | "10-25" | "25-40" | "40-60" | "60-80" | "80-plus"
```

### `WEEK1_VOLUME_KM` (volume-progression.ts)

Starting weekly volume used by the linear progression and the compound ramp in `computeConstraints()`.

```ts
export const WEEK1_VOLUME_KM: Record<WeeklyMileageRange, number> = {
  "0-10":   10,
  "10-25":  15,
  "25-40":  30,   // unchanged from old "under-40"
  "40-60":  40,
  "60-80":  60,
  "80-plus": 80,
}
```

### `MILEAGE_RANGE_HIGH` (constraints.ts)

Aspirational peak used as fallback when no goal time is provided.

```ts
const MILEAGE_RANGE_HIGH: Record<WeeklyMileageRange, number> = {
  "0-10":   25,
  "10-25":  35,
  "25-40":  40,   // unchanged from old "under-40"
  "40-60":  60,
  "60-80":  80,
  "80-plus": 120,
}
```

### `GF_CAP` (phase-planner.ts)

General Fitness phase cap (weeks). Beginners get the same cap as the old "under-40".

```ts
const GF_CAP: Record<WeeklyMileageRange, number> = {
  "0-10":   12,
  "10-25":  12,
  "25-40":  12,   // unchanged from old "under-40"
  "40-60":  10,
  "60-80":   8,
  "80-plus":  6,
}
```

### Training Structure (training-parameters.ts)

Default run days and quality session counts per bracket. These are defaults; the scheduler uses `selectedDays.length` from the user's actual choices.

```ts
if      (weeklyMileageRange === "0-10")   { run = 3; rest = 4; quality = 0 }
else if (weeklyMileageRange === "10-25")  { run = 4; rest = 3; quality = 1 }
else if (weeklyMileageRange === "25-40")  { run = 5; rest = 2; quality = 1 } // was "under-40"
else if (weeklyMileageRange === "40-60")  { run = 6; rest = 1; quality = 1 }
else if (weeklyMileageRange === "60-80")  { run = 6; rest = 1; quality = 2 }
else if (weeklyMileageRange === "80-plus"){ run = 7; rest = 0; quality = 2 }
```

---

## Section 3: Feasibility Warning Impact

With new starting volumes, the compound ramp correctly limits achievable peaks for beginners:

**Scenario: 20 weeks, full marathon, first-timer (ramp = 0.08), no goal time provided**

Without a goal time, `aspirationalPeakKm = MILEAGE_RANGE_HIGH[bracket]`. `peakWeeklyKm = min(aspirational, achievable)`.

| Bracket | WEEK1 | Achievable (ramp) | Aspirational (MILEAGE_RANGE_HIGH) | Clamped peak | Long run (×0.40) | Warning? |
|---|---|---|---|---|---|---|
| `"0-10"` | 10 km | ≈ 37 km | 25 km | **25 km** | ≈ 10 km | **Yes** (< 26 km) |
| `"10-25"` | 15 km | ≈ 55 km | 35 km | **35 km** | ≈ 14 km | **Yes** (< 26 km) |
| `"25-40"` | 30 km | ≈ 111 km | 40 km | **40 km** | ≈ 16 km | **Yes** (< 26 km) |

**Scenario: 20 weeks, full marathon, first-timer, fast goal time (e.g., 2:05 — the original bug report)**

When a goal time is provided, `aspirationalPeakKm = computeGoalPeakMileage(distance, goalMinutes)?.high`, which for a 2:05 full marathon target is ~120+ km.

| Bracket | WEEK1 | Achievable (ramp) | Aspirational (from goal time) | Clamped peak | Long run | Warning? |
|---|---|---|---|---|---|---|
| Old `"under-40"` | 30 km | ≈ 111 km | 120+ km | **111 km** | ≈ 44 km | **No** ← bug |
| `"0-10"` | 10 km | ≈ 37 km | 120+ km | **37 km** | ≈ 15 km | **Yes** ← fixed |
| `"10-25"` | 15 km | ≈ 55 km | 120+ km | **55 km** | ≈ 22 km | **Yes** ← fixed |
| `"25-40"` | 30 km | ≈ 111 km | 120+ km | **111 km** | ≈ 44 km | No (correct — 30 km/wk base is plausible for this goal) |

The root cause of the original bug: `WEEK1 = 30` gave the ramp calculation enough headroom to reach ~111 km, which exceeded the 26 km long-run threshold even for a true beginner. Splitting the bracket and using `WEEK1 = 10` caps the ramp at ~37 km — a realistic ceiling for someone starting from near zero.

The warning condition in `computeConstraints()` is `achievableLongRunKm < 26` (for full) and `< 16` (for half).

This is the primary bug fix. No changes to `computeConstraints()` logic are needed — the corrected `WEEK1_VOLUME_KM` inputs produce correct outputs.

---

## Section 4: UI — `step-weekly-mileage.tsx`

The step renders 6 `OnboardingCard` options following the existing pattern. Each card has:
- **Label** (bold): activity-level description (e.g., "Just getting started")
- **Description** (subtext): behavioural description (e.g., "Little or no current running")
- **km range** (right-aligned secondary): numeric range for experienced runners (e.g., "0–10 km/wk")

The `MileageRange` local type updates to match `WeeklyMileageRange`. The file has two parallel constants — `KM_OPTIONS` and `MILES_OPTIONS` — both expand from 4 to 6 entries.

**KM_OPTIONS additions:**
```ts
{ value: "0-10",  label: "Just getting started", description: "Little or no current running",            range: "0–10 km/wk"  },
{ value: "10-25", label: "Occasional runner",     description: "1–2 runs a week, mostly short",          range: "10–25 km/wk" },
{ value: "25-40", label: "Regular runner",        description: "3–4 days/week, comfortable up to ~10 km", range: "25–40 km/wk" },
// existing "40-60", "60-80", "80-plus" entries unchanged
```

**MILES_OPTIONS additions** (rounded to nearest mile):
```ts
{ value: "0-10",  label: "Just getting started", description: "Little or no current running",            range: "0–6 mi/wk"   },
{ value: "10-25", label: "Occasional runner",     description: "1–2 runs a week, mostly short",          range: "6–15 mi/wk"  },
{ value: "25-40", label: "Regular runner",        description: "3–4 days/week, comfortable up to ~10 km", range: "15–25 mi/wk" },
// existing entries update: "under-40" label "Under 25 mi/week" becomes "25-40" value
```

Note: `computePhases()` has a default parameter `weeklyMileageRange = "40-60"` — no change needed, `"40-60"` remains valid.

---

## Section 5: Ancillary Updates

### `apps/web/components/onboarding/types.ts`

```ts
weeklyMileageRange?: WeeklyMileageRange  // import from plan-engine/types or duplicate
```

Remove the inline union and use the plan-engine type (or keep in sync manually — either is fine).

### `apps/web/app/plan/page.tsx`

`validRanges` array expands from 4 to 6 values. Default fallback (`"40-60"`) stays unchanged.

### Tests

All test files referencing `"under-40"` update to `"25-40"` (same constants, just renamed). New tests cover:
- `WEEK1_VOLUME_KM` for `"0-10"` and `"10-25"`
- Feasibility warning fires for `"0-10"` first-timer full marathon at 20 weeks
- Feasibility warning fires for `"10-25"` first-timer full marathon at 20 weeks (long run ≈ 14 km < 26 km)
- Feasibility warning **fires** for `"10-25"` first-timer **half** marathon at 20 weeks, no goal time (clamped peak = 35 km, long run = 35 × 0.38 ≈ 13 km < 16 km threshold)
- `"25-40"` produces identical results to old `"under-40"` (regression)

---

## File Checklist

| File | Change |
|---|---|
| `packages/plan-engine/src/types.ts` | Expand `WeeklyMileageRange` |
| `packages/plan-engine/src/volume-progression.ts` | Add 2 entries to `WEEK1_VOLUME_KM` |
| `packages/plan-engine/src/constraints.ts` | Add 2 entries to `MILEAGE_RANGE_HIGH` |
| `packages/plan-engine/src/phase-planner.ts` | Add 2 entries to `GF_CAP` |
| `packages/plan-engine/src/training-parameters.ts` | Add 2 cases |
| `apps/web/components/onboarding/steps/step-weekly-mileage.tsx` | 6 activity-level cards |
| `apps/web/components/onboarding/types.ts` | Expand local `weeklyMileageRange` union |
| `apps/web/app/plan/page.tsx` | Expand `validRanges` |
| `packages/plan-engine/src/constraints.test.ts` | Rename `"under-40"` → `"25-40"` (4 occurrences) |
| `packages/plan-engine/src/phase-planner.test.ts` | Rename `"under-40"` → `"25-40"` (3 occurrences) |
| `packages/plan-engine/src/volume-progression.test.ts` | Rename `"under-40"` → `"25-40"` (2 occurrences) |
| `packages/plan-engine/src/training-parameters.test.ts` | Rename `"under-40"` → `"25-40"` (1 occurrence) |
| `apps/web/app/api/generate-plan/route.test.ts` | Rename `"under-40"` → `"25-40"` (line 170) |
| Historical docs (`docs/superpowers/plans/`, `docs/superpowers/specs/`) | No change required — doc files are exempt |
