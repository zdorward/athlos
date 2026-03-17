# GF Phase Duration — Mileage-Based Scaling Design

**Date:** 2026-03-17
**Status:** Approved

## Overview

`computePhases` currently allocates General Fitness (GF) as a fixed percentage of total weeks with no awareness of the runner's current fitness. A 29-week plan always produces GF=3 regardless of whether the runner is at 30 km/week or 80+ km/week, and a 52-week plan only produces GF=5 — too small for a plan where the structured training block is ~24 weeks and GF should fill most of the remaining space.

The fix: invert the allocation order so Base and Build are sized first (by percentage of total weeks), then GF fills the remainder up to a mileage-bracket cap. This lets GF behave as a "pre-training fill" for long plans while preventing unlimited growth on very long plans. Additionally, `peakMin` for full marathon is bumped from 3 to 4 weeks, matching the science target of 15–20% of plan.

---

## Problem

Two failure modes in the current algorithm:

1. **GF too small on long plans for lower-fitness runners.** A 29-week "under-40" runner gets GF=3, leaving no meaningful pre-training adaptation window. GF at 60–75% 1RM strength loading requires 8–10 weeks to establish connective tissue tolerance before progressing. 3 weeks is insufficient.

2. **GF doesn't scale with plan length.** For a runner starting a year out (52 weeks), GF should fill most of the gap before structured training begins. At 10% of total weeks, a 52-week plan only gets GF=5.

---

## Fix

### 1. Add `weeklyMileageRange` parameter to `computePhases`

**File:** `packages/plan-engine/src/pace-calculator.ts`

```ts
export function computePhases(
  totalWeeks: number,
  distance: string,
  weeklyMileageRange: "under-40" | "40-60" | "60-80" | "80-plus" = "40-60"
): PhaseEntry[]
```

The parameter is optional with a `"40-60"` default so existing callers without the argument continue to work.

### 2. GF cap table

```ts
const GF_CAP: Record<string, number> = {
  "under-40": 12,
  "40-60":    10,
  "60-80":     8,
  "80-plus":   6,
}
```

Cap values are grounded in connective tissue adaptation timelines (8–10 weeks, `strength-training-science.md`) and training monotony evidence (`modern-marathon-science.md`). Higher-mileage runners have more established tissue tolerance and aerobic base, so their GF ceiling is lower.

### 3. Inverted 5-phase allocation

Current order: GF → Base → Build → Peak (overflow).
New order: Base → Build → GF (capped) → Peak (overflow). Phases are still **pushed in chronological order** (GF first, then Base, Build, Peak).

```ts
// Compute Base and Build first
const base  = Math.min(remaining, Math.max(1, Math.round(totalWeeks * 0.30)))
remaining -= base
const build = Math.min(remaining, Math.max(1, Math.round(totalWeeks * 0.30)))
remaining -= build

// GF fills whatever is left, capped by mileage bracket
const gf = Math.min(remaining, GF_CAP[weeklyMileageRange] ?? 10)
remaining -= gf

// Peak gets any overflow above the cap
const peak = peakMin + Math.max(0, remaining)

// Push in chronological order
pushPhase("General Fitness", gf)
pushPhase("Base",  base)
pushPhase("Build", build)
pushPhase("Peak",  peak)
```

### 4. Separate `peakMin` from `taperMin` for full marathon

Currently both use `getTaperMin(distance)` which returns 3 for full/half. Full marathon Peak should be at minimum 4 weeks (science target: 15–20% of plan). Extract a `getPeakMin` function:

```ts
function getPeakMin(distance: string): number {
  if (distance === "5k" || distance === "10k") return 2
  if (distance === "half") return 3
  return 4  // full, ultra, unknown
}
```

`getTaperMin` is unchanged. `peakMin` in `computePhases` uses `getPeakMin(distance)` instead of `getTaperMin(distance)`.

### 5. Update call site

**File:** `apps/web/app/api/generate-plan/route.ts`

```ts
// Before
const phases = computePhases(totalWeeks, input.race.distance)

// After
const phases = computePhases(totalWeeks, input.race.distance, input.weeklyMileageRange)
```

`input.weeklyMileageRange` is already available at this call site (used two lines above).

### 6. Move `WeeklyMileageRange` type to `types.ts`

`WeeklyMileageRange` is currently a local type in `workout-scheduler.ts`. Since `computePhases` now uses it, move it to `types.ts` and import from there in both files. Export it from `index.ts`.

---

## Concrete Outputs

Full marathon, taper=3, peakMin=4:

| Plan length | Mileage range | GF | Base | Build | Peak | Taper |
|-------------|---------------|-----|------|-------|------|-------|
| 21 weeks | 40-60 | 2 | 6 | 6 | 4 | 3 |
| 22 weeks | 40-60 | 1 | 7 | 7 | 4 | 3 |
| 29 weeks | under-40 | 4 | 9 | 9 | 4 | 3 |
| 29 weeks | 40-60 | 4 | 9 | 9 | 4 | 3 |
| 29 weeks | 80-plus | 4 | 9 | 9 | 4 | 3 |
| 52 weeks | under-40 | 12 | 16 | 16 | 5 | 3 |
| 52 weeks | 80-plus | 6 | 16 | 16 | 11 | 3 |

For 29-week plans, the GF cap does not bite (remaining after Base+Build = 4, below all caps). Mileage range starts differentiating GF at ~35+ weeks.

---

## Out of Scope

- Phase allocation for 4-phase plans (≤20 weeks) — unchanged
- Base/Build percentage targets (0.30/0.30) — unchanged
- Half marathon `peakMin` — remains 3
- 52-week Base=16 / Build=16 — accepted; extra volume in longer phases is appropriate for extended plans

---

## Files Changed

| File | Change |
|------|--------|
| `packages/plan-engine/src/types.ts` | Add `WeeklyMileageRange` type |
| `packages/plan-engine/src/pace-calculator.ts` | Add `GF_CAP` table; add `getPeakMin`; update `computePhases` signature and 5-phase algorithm |
| `packages/plan-engine/src/workout-scheduler.ts` | Import `WeeklyMileageRange` from `types.ts` instead of local declaration |
| `packages/plan-engine/src/index.ts` | Export `WeeklyMileageRange` |
| `packages/plan-engine/src/pace-calculator.test.ts` | Update 2 exact-match tests; add 5 new tests |
| `apps/web/app/api/generate-plan/route.ts` | Pass `input.weeklyMileageRange` to `computePhases` |
