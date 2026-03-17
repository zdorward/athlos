# Quality Session and Strength Day Placement

**Date:** 2026-03-17
**Status:** Approved

## Overview

Two targeted changes to `workout-scheduler.ts` that together produce a more physiologically sound weekly structure:

1. **Quality session sort** — change from "earliest eligible day" to "day furthest from the long run." For a Mon–Fri + Sunday runner this moves tempo from Tuesday to Wednesday.
2. **Strength adjacency to long run** — change from symmetric (block both Saturday and Monday) to pre-only (block only Saturday). Monday after the long run becomes eligible for strength.

Together these produce 2 non-adjacent strength sessions per week (Monday + Friday) in Base and Build, where the science requires 2x/week heavy resistance.

Rationale is documented in `docs/training-science/quality-and-strength-placement.md`.

---

## Problem

### 1. Quality sessions land on the earliest available day, not the best day

`scheduleWorkouts` sorts quality session candidates by ascending day index (line 278–280):

```ts
const candidate = [...candidates].sort(
  (a, b) => (DAY_INDEX[a.dayKey] ?? 0) - (DAY_INDEX[b.dayKey] ?? 0)
)[0]
```

For a Mon–Fri runner with Sunday long run, the first eligible day is Tuesday (Monday is adjacent to Sunday). This leaves Thursday and Friday as the only eligible strength days — but those are adjacent, so only one strength session can be placed.

### 2. Strength adjacency to the long run is symmetric

The strength candidate filter (line 341) uses `isAdjacentTo(dayKey, longRunDay)`, which blocks both the day before (Saturday) and the day after (Monday) the long run. Blocking Monday has weak physiological justification — the concern is fatigue *going into* a hard effort, not residual recovery after one. Many elite programs place an easy run + strength on Monday as an activation strategy.

---

## Fix

**File:** `packages/plan-engine/src/workout-scheduler.ts`

### Change 1: Quality session sort

Replace the ascending-index sort with a descending circular-distance-from-long-run sort. Add `longIdx` before the quality loop (it is currently declared later for the strength section — move or duplicate):

Hoist `longIdx` to just above the quality loop (before line 265), removing its existing declaration from the strength section (line 328):

```ts
// Hoist this declaration above the quality loop (was in the strength section at line 328)
const longIdx = DAY_INDEX[longRunDay] ?? 0
```

Then replace the quality sort (lines 278–280):

```ts
// Before
const candidate = [...candidates].sort(
  (a, b) => (DAY_INDEX[a.dayKey] ?? 0) - (DAY_INDEX[b.dayKey] ?? 0)
)[0]

// After
const candidate = [...candidates].sort(
  (a, b) =>
    circularDist(DAY_INDEX[b.dayKey] ?? 0, longIdx) -
    circularDist(DAY_INDEX[a.dayKey] ?? 0, longIdx)
)[0]
```

`circularDist` is already defined in the file (line 165). Ties (e.g., Wednesday and Thursday both at distance 3 from Sunday) are broken by the sort's natural stability — whichever appears first in the filtered array, which follows DAY_ORDER (Mon→Sun), so Wednesday wins over Thursday.

### Change 2: Strength adjacency — pre-only for long run

In the strength candidate filter (around line 337–344), replace the symmetric adjacency check with a directional one that only blocks the day immediately *before* the long run:

```ts
// Before
!isAdjacentTo(dayKey, longRunDay) &&

// After
(DAY_INDEX[dayKey] ?? 0) !== (longIdx - 1 + 7) % 7 &&
```

`(longIdx - 1 + 7) % 7` computes the day index of the day before the long run (e.g., Saturday = 5 when long run is Sunday = 6). This blocks Saturday but not Monday.

---

## Effect

### Mon–Fri + Sunday long run (standard advanced runner schedule)

**Base (1 quality: tempo)**

| Day | Before | After |
|-----|--------|-------|
| Mon | Easy | Easy + **Strength** |
| Tue | Easy + Strength (only) | Easy |
| Wed | **Tempo** (was Tue) | **Tempo** |
| Thu | Easy | Easy |
| Fri | Easy | Easy + **Strength** |
| Sat | Rest | Rest |
| Sun | Long | Long |

Result: 2 strength sessions (Mon + Fri), non-adjacent, correctly spaced from long run and tempo.

**Build early (2 quality: tempo + intervals)**

| Day | After |
|-----|-------|
| Mon | Easy + Strength |
| Tue | Easy |
| Wed | **Tempo** |
| Thu | Easy |
| Fri | **Intervals** |
| Sat | Rest |
| Sun | Long |

Strength: Monday only (1 session). Friday has intervals; Thursday is adjacent to both Wednesday (tempo) and Friday (intervals), leaving Monday as the sole eligible strength day. This is acceptable for a high-intensity week — the priority is executing two quality sessions well.

**Build late / Peak (tempo + MP or MP + tempo)**

Same pattern: Wednesday primary quality, Friday secondary quality, Monday strength.

---

## Existing tests that will break

The following tests in `packages/plan-engine/src/workout-scheduler.test.ts` assume quality sessions land on Tuesday and must be updated:

1. Any test asserting a specific date for a tempo or quality session that falls on a Tuesday — update to Wednesday equivalent.
2. Any test asserting strength is on a specific day that assumed Tuesday was a non-quality day.

The test suite should be run after the change to identify all failures.

---

## Out of Scope

- No changes to which phase gets which quality session types (PHASE_CONFIG unchanged)
- No changes to the quality session adjacency-to-long-run rule (symmetric, unchanged)
- No changes to the quality-to-quality adjacency rule (unchanged)
- No changes to the strength-to-quality adjacency rule (symmetric, unchanged — both sides of a quality day still block strength)
- No changes to volume progression, taper, or race week logic

---

## Files Changed

| File | Change |
|------|--------|
| `packages/plan-engine/src/workout-scheduler.ts` | Hoist `longIdx` declaration; change quality sort to descending circular distance; change strength long-run adjacency to pre-only |
| `packages/plan-engine/src/workout-scheduler.test.ts` | Update tests that assert quality session day placement; update tests that assert strength session day placement |
