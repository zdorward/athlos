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

Cap values are grounded in two evidence sources from the training science docs:

- **Connective tissue adaptation** (`strength-training-science.md`): 8–10 weeks to establish tissue tolerance at GF-level loading (60–75% 1RM). This directly supports the 60-80 cap of 8 weeks.
- **Aerobic base and training monotony** (`modern-marathon-science.md`): lower-mileage runners (under-40, 40-60) need additional GF time to build aerobic base from a lower starting volume. Beyond 10–12 weeks without a quality stimulus, training monotony risk increases, making further GF weeks counterproductive.

Higher-mileage runners have pre-established tissue tolerance and aerobic base, so their ceiling is lower (6–8 weeks). The caps do not represent "optimal GF duration" — they represent the maximum beyond which additional GF weeks yield diminishing returns.

### 3. Inverted 5-phase allocation

Current order: GF → Base → Build → Peak (overflow).
New order: Base → Build → GF (capped) → Peak (overflow). Phases are still **pushed in chronological order** (GF first, then Base, Build, Peak).

```ts
let remaining = totalWeeks - taperMin - peakMin

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

`WeeklyMileageRange` is currently declared as a local type in both `workout-scheduler.ts` and `volume-progression.ts`. Move the single canonical definition to `types.ts`, import it in both files, and update `PlanGenerationInput` in `types.ts` to reference the named type instead of the inline union. Export it from `index.ts`.

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

## Tests

**Update (3 tests):**

- 28-week exact-match: `GF=3, Base=8, Build=8, Peak=6` → `GF=5, Base=8, Build=8, Peak=4`
- 22-week exact-match: `GF=2, Base=7, Build=7, Peak=3` → `GF=1, Base=7, Build=7, Peak=4`
- 22-week soft invariant: `peak >= 3` → `peak >= 4`

**Add (5 tests):**

- 29-week, "under-40": GF=4, Base=9, Build=9, Peak=4, Taper=3
- 29-week, "80-plus": GF=4, Base=9, Build=9, Peak=4, Taper=3 (cap doesn't bite; same as under-40)
- 52-week, "under-40": GF=12 (capped at bracket max)
- 52-week, "80-plus": GF=6 (capped lower)
- Full marathon peak is at least 4 weeks (invariant test for peakMin change)

**GF floor:** `gf` has no explicit floor. If `remaining` after Base+Build is 0, GF=0 and `pushPhase` silently skips the phase. This degenerates to 4-phase behavior and is correct — GF is unnecessary in that scenario.

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
| `packages/plan-engine/src/volume-progression.ts` | Import `WeeklyMileageRange` from `types.ts` instead of local declaration |
| `packages/plan-engine/src/pace-calculator.test.ts` | Update 3 tests (2 exact-match + 1 soft invariant); add 5 new tests |
| `apps/web/app/api/generate-plan/route.ts` | Pass `input.weeklyMileageRange` to `computePhases` |
