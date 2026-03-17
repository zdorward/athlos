# Race Week Training Volume Cap

**Date:** 2026-03-17
**Status:** Approved

## Overview

Cap pre-race easy run volume in race week at 20 km regardless of the taper percentage formula. Currently the race week handler distributes `weeklyKm` (40% of peak) across selected easy run days, then adds a 5 km shakeout and the 42.2 km marathon on top. For a ~100 km peak plan this produces ~45 km of pre-race training, which accumulates fatigue in the week the runner needs to be freshest.

---

## Problem

In `scheduleWorkouts` (`packages/plan-engine/src/workout-scheduler.ts`), the race week early-exit path distributes the full taper volume (`weeklyKm`) across eligible easy run days:

```ts
const perDay = round05(weeklyKm / eligibleDays.length)
```

`weeklyKm` for the last taper week is `peakWeeklyKm * 0.4`. For a 100 km peak plan:
- Easy runs: 40 km spread across eligible days (e.g., 5 days × 8 km)
- Shakeout (Sat): 5 km
- **Pre-race training total: ~45 km** — physiologically wrong; the marathon is not a training run and the runner needs to arrive fresh

The marathon is not a training run. It should not be preceded by 40+ km of accumulated easy miles in the same week. Modern marathon coaching prescribes 20–25 km of pre-race running in race week (short maintenance jogs, nothing more).

---

## Fix

**File:** `packages/plan-engine/src/workout-scheduler.ts`

Add a constant near the top of the file:

```ts
const RACE_WEEK_MAX_TRAINING_KM = 20
```

In the race week handler, replace the `weeklyKm` reference in the easy run distribution with a capped value:

```ts
// Before
const perDay = round05(weeklyKm / eligibleDays.length)

// After
const raceWeekTrainingKm = Math.min(weeklyKm, RACE_WEEK_MAX_TRAINING_KM)
const perDay = round05(raceWeekTrainingKm / eligibleDays.length)
```

### Effect

For a 100 km peak plan with 3 eligible easy run days (Mon, Wed, Fri):
- Easy runs: 20 km ÷ 3 = ~6.5 km each (was ~13 km each)
- Shakeout (Sat): 5 km (unchanged)
- Pre-race training total: ~25 km (was ~45 km)

The cap also applies for lower-mileage plans where 40% of peak is already ≤ 20 km — `Math.min` is a no-op in those cases.

---

## Science Rationale

From modern marathon coaching consensus: race week is not a training stimulus week. Its purpose is to arrive at the start line fresh. Running 40+ km in the 6 days before a marathon accumulates glycogen depletion and muscular fatigue. The standard prescription is short maintenance jogs (3–5 km each) totalling 15–25 km, plus a 4–5 km shakeout the day before.

The 40% taper volume figure is a guideline for regular taper weeks (where a long run, quality session, and easy runs need to be distributed). Race week has a fundamentally different structure — the marathon itself is the week's primary event — so its training budget should be managed separately.

---

## Out of Scope

- No changes to taper percentages (0.8 / 0.6 / 0.4) in `volume-progression.ts`
- No changes to shakeout distance (stays 5 km)
- No changes to how the weekly km total is displayed in the calendar (it will naturally drop because easy run distances are smaller)
- Race day intentionally remains `type: "rest"` in the scheduler output — the race entry is managed separately at the API/display layer and is not part of the volume cap logic

---

## Files Changed

| File | Change |
|------|--------|
| `packages/plan-engine/src/workout-scheduler.ts` | Add `RACE_WEEK_MAX_TRAINING_KM = 20` constant; cap easy run distribution in race week handler |
| `packages/plan-engine/src/workout-scheduler.test.ts` | Update "race week easy run total ≈ peakWeeklyKm * 0.4" test: replace the `> 38 && < 42` bounds with `> 18 && <= 20` to reflect the cap; add test asserting per-day easy distance is ≤ 7 km |
