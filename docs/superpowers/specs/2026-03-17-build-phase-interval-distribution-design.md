# Build Phase Interval Distribution

**Date:** 2026-03-17
**Status:** Approved

## Overview

Fix the early/late Build phase split so VO2max interval sessions are distributed as a meaningful sharpening stimulus across all plan lengths. Currently, certain plan lengths (16, 18, 21 weeks) produce only 1 interval session because the 50/50 early/late split places a recovery week at the boundary of early Build, consuming the only non-recovery early-Build week.

The fix: change the early/late boundary from 50% to 60% of Build weeks.

---

## Problem

In `getQualityConfig` (`packages/plan-engine/src/workout-scheduler.ts`), the early/late Build boundary is:

```ts
const slot = localIndex < Math.floor(buildLength / 2)
```

Early Build weeks receive `["tempo", "intervals"]`; late Build weeks receive `["tempo", "mp"]`. Recovery weeks (any week where `week % 4 === 0`) drop to 1 quality session (tempo only).

For a 21-week plan, Build = W11–15. `Math.floor(5 / 2) = 2`, so early Build = W11–12. W12 is a recovery week, leaving W11 as the **only non-recovery early Build week** — 1 intervals session total. Exercise physiology research on VO2max adaptation requires 3–5 weeks of consistent interval stimulus; 1 session provides no meaningful adaptation.

The same structural problem affects 16-week and 18-week plans.

---

## Fix

**File:** `packages/plan-engine/src/workout-scheduler.ts`

Replace:
```ts
const slot = localIndex < Math.floor(buildLength / 2)
```

With:
```ts
const slot = localIndex < Math.ceil(buildLength * 0.6)
```

### Effect by plan length

| Plan | Build | Early (before) | Early (after) | Intervals (before → after) |
|------|-------|----------------|---------------|---------------------------|
| 16-week | 4 wks | 2 wks (W7–8, W8=recovery) | 3 wks (W7–9) | 1 → 2 |
| 18-week | 5 wks | 2 wks (W8=recovery, W9 only productive week) | 3 wks (W8–10, W8=recovery) | 1 → 2 |
| 20-week | 6 wks | 3 wks (W9–11) | 4 wks (W9–12, W12=recovery) | 3 → 3 |
| 21-week | 5 wks | 2 wks (W11–12, W12=recovery) | 3 wks (W11–13) | 1 → 2 |
| 24-week | 6 wks | 3 wks (W13–15) | 4 wks (W13–16, W16=recovery) | 3 → 3 |

For 20-week and 24-week plans the early/late boundary shifts from 3 to 4 weeks, but the interval count stays at 3 because the newly included 4th week is a recovery week in both cases (W12 for 20-week, W16 for 24-week). The fix only increases interval session counts for plan lengths where a recovery week was consuming the last productive early-Build week (16, 18, 21-week).

### MP volume tradeoff

For affected plan lengths, late Build shrinks by 1 week. For a 21-week plan, late Build goes from W13–15 (3 MP sessions) to W14–15 (2 MP sessions in Build). Peak (W16–18) is unchanged — 2 MP sessions. Total MP sessions: 5 → 4. The science doc's requirement that MP dominate the final 6–8 weeks is still satisfied.

---

## Science Rationale

From `docs/training-science/modern-marathon-science.md`:

> VO2max intervals are most effective as a **sharpening stimulus** in mid-Build after threshold capacity is established.

A single interval session cannot constitute a sharpening stimulus. The 60% split ensures early Build spans the majority of the Build phase, giving at least 2 non-recovery early-Build weeks for meaningful interval exposure before the plan transitions to MP work.

---

---

## Interval Workout Note

**File:** `apps/web/app/plan/workout-utils.ts` — `getWorkoutNote`

The current intervals note is generic: `"Hard efforts with full recovery between reps."` It should prescribe a concrete session structure using the workout's distance and target pace.

### Formula

Rep count: `Math.max(3, Math.round(distanceKm - 2))` — subtracts ~2km overhead for warmup/cooldown, rounds to nearest rep, floored at 3.

Rep distance: 1km (standard VO2max stimulus for marathon training).

### Output

When `distanceKm` is defined and `targetPace` is defined:
> `"[N]×1km at [targetPace] with 2–3 min jog recovery. Stop the session if your pace slips — quality over quantity."`

When `distanceKm` is defined but `targetPace` is not:
> `"[N]×1km at VO2max pace with 2–3 min jog recovery. Stop the session if your pace slips — quality over quantity."`

When `distanceKm` is undefined (fallback):
> `"800m–1km repeats at VO2max pace with 2–3 min jog recovery."`

### Examples

| `distanceKm` | `targetPace` | Note |
|---|---|---|
| 10 | `"4:30–4:45/km"` | `"8×1km at 4:30–4:45/km with 2–3 min jog recovery. Stop the session if your pace slips — quality over quantity."` |
| 6 | `"4:30–4:45/km"` | `"4×1km at 4:30–4:45/km with 2–3 min jog recovery. Stop the session if your pace slips — quality over quantity."` |
| undefined | — | `"800m–1km repeats at VO2max pace with 2–3 min jog recovery."` |

---

## Out of Scope

- No changes to recovery week policy (still 1 tempo on recovery weeks in Build)
- No changes to late Build session types (still `["tempo", "mp"]`)
- No changes to `computePhases` or phase durations
- No changes to interval HR zone (`"Zone 4–5"` stays)

---

## Files Changed

| File | Change |
|------|--------|
| `packages/plan-engine/src/workout-scheduler.ts` | Change `Math.floor(buildLength / 2)` to `Math.ceil(buildLength * 0.6)` in `getQualityConfig` |
| `packages/plan-engine/src/workout-scheduler.test.ts` | Update/add tests verifying interval session counts for 16, 18, and 21-week plans; update existing "Build early half" and "Build second half" test comments that reference the old `Math.floor(buildLength / 2)` formula |
| `apps/web/app/plan/workout-utils.ts` | Update `getWorkoutNote` for `"intervals"` to compute and include rep count, rep distance, and target pace |
| `apps/web/app/plan/workout-utils.test.ts` | Create new test file; add tests for the updated `getWorkoutNote` intervals case covering all three branches (distanceKm + targetPace defined, distanceKm only, distanceKm undefined) |
