# Progression Long Run Recovery Week Fix

**Date:** 2026-03-17
**Status:** Approved

## Overview

`getLongRunType` currently assigns progression long runs based on a modular pattern (`localIndex % 3 === 2` in Build, `localIndex % 2 === 1` in Peak) without checking whether the week is a recovery week. Recovery weeks should always produce an easy long run — adding a progression on a reduced-volume recovery week undermines the recovery purpose and contradicts the training science prescription ("1 every 3–4 weeks in Build/Peak" refers to normal training weeks only).

---

## Problem

`getLongRunType(phase, localIndex)` has no awareness of recovery weeks. If the modular pattern coincidentally aligns with a recovery week (week number divisible by 4), that week gets a progression long run. For the current 21-week plan this happens not to occur, but it is a latent bug for other plan lengths.

The training science doc (`docs/training-science/modern-marathon-science.md`) states:
> ~25% of long runs (1 every 3–4 weeks in **Build/Peak**): include MP segments.

Recovery weeks are reduced-volume weeks (~70% of prior peak). Assigning a progression — which requires finishing the long run at marathon pace — on a recovery week contradicts the recovery purpose and the science prescription.

---

## Fix

**File:** `packages/plan-engine/src/workout-scheduler.ts`

Add `isRecovery: boolean` as a third parameter to `getLongRunType`. If true, return `"long"` unconditionally before the modular checks.

```ts
// Before
function getLongRunType(phase: string, localIndex: number): "long" | "progression" {
  if (phase === "Build" && localIndex % 3 === 2) return "progression"
  if (phase === "Peak"  && localIndex % 2 === 1) return "progression"
  return "long"
}

// After
function getLongRunType(phase: string, localIndex: number, isRecovery: boolean): "long" | "progression" {
  if (isRecovery) return "long"
  if (phase === "Build" && localIndex % 3 === 2) return "progression"
  if (phase === "Peak"  && localIndex % 2 === 1) return "progression"
  return "long"
}
```

The call site already computes `isRecovery` on line 260:
```ts
const isRecovery = week % 4 === 0 && week !== preTaperWeeks
```

Pass it through:
```ts
// Before
type: getLongRunType(phase, localIndex),

// After
type: getLongRunType(phase, localIndex, isRecovery),
```

No other changes. The modular pattern and all other logic remain unchanged.

---

## Effect

For any plan length where the modular pattern would assign a progression on a recovery week (week divisible by 4), that week now correctly produces a regular long run. Normal weeks are unaffected.

For the current 21-week plan (Build W11–15, Peak W16–18): no observable change — W13 and W17 are already normal weeks. The fix closes a latent correctness bug that would surface with other plan configurations.

---

## Out of Scope

- No change to the modular progression frequency (Build every 3rd week, Peak every other week)
- No change to Base phase (Base long runs are always `"long"` — unchanged)
- No change to Taper or General Fitness phases
- No change to `isRecovery` calculation

---

## Files Changed

| File | Change |
|------|--------|
| `packages/plan-engine/src/workout-scheduler.ts` | Add `isRecovery` parameter to `getLongRunType`; pass `isRecovery` at call site |
| `packages/plan-engine/src/workout-scheduler.test.ts` | Add test: recovery week in Build never produces a progression long run |
