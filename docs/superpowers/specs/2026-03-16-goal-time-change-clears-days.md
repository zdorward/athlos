# Goal Time Change Clears Running Days

**Date:** 2026-03-16
**Status:** Approved

---

## Problem

When a user navigates back to the goal time step after already passing through the "Which Days" step, changes their goal time, and advances forward again, the running days are not recomputed. `formData.selectedDays` is already set from the first pass, so `StepWhichDays` treats it as a back-navigation and skips the goal-time-driven default logic entirely.

---

## Root Cause

`StepWhichDays` uses `formData.selectedDays === undefined` as a proxy for "first visit." Once the user has advanced past that step, `selectedDays` is set and never cleared — even when the goal time changes upstream.

---

## Fix

In `onboarding-flow.tsx`, extend `handleNext` to detect when the user is submitting from the `goalTime` step with a changed goal time. If the goal time changed, clear `selectedDays` and `longRunDay` from the merged `formData` before saving state.

**Change detection rules:**

Comparison must be value-based (compare `hours` and `minutes` individually), not reference-based — `data.goalTime` and `formData.goalTime` are always different object instances.

| Condition | Clears days? |
|---|---|
| `timeGoal` changed from `true` → `false` (user selects "no goal time") | Yes |
| `timeGoal` changed from `false` (or `undefined`) → `true` with a valid time | Yes |
| `timeGoal` is `true` on both sides and `hours` or `minutes` changed | Yes |
| `timeGoal` and `goalTime` are identical to the existing `formData` values | No — preserve existing days |
| `formData.selectedDays` was never set (first visit, nothing to clear) | No-op — clearing `undefined` is safe but has no effect |

`goalTime` with `hours: 0, minutes: 0` is pathological but possible (the step's `timeIsValid` allows it). It must still trigger a clear if the value differs from what is currently stored.

When `formData.goalTime` is `undefined` (user never set one), comparing against a new `goalTime` object must treat `undefined` as "old value is absent" — any non-undefined incoming `goalTime` paired with `timeGoal: true` is a change.

**Result:** The next time `StepWhichDays` renders, it sees `formData.selectedDays === undefined`, treats it as a first visit, and recomputes the default from the new goal time.

---

## Files Changed

| File | Change |
|---|---|
| `apps/web/components/onboarding/onboarding-flow.tsx` | Extend `handleNext` to clear `selectedDays` and `longRunDay` when goal time changes |

## Out of Scope

- No changes to `StepWhichDays`, `StepGoalTime`, or any other step
- No changes to the `isFirstVisit` / `defaultDays` logic in `StepWhichDays`
- `longRunDay` is cleared alongside `selectedDays` because it is derived from the same preset — keeping a stale long run day when days are cleared would be inconsistent
- **sessionStorage draft interaction:** If the user refreshes after changing goal time but before reaching `StepWhichDays`, the draft will contain the new `goalTime` alongside the old `selectedDays`. In that case `handleNext` from the goal time step never runs again, so days are not cleared. This is a pre-existing limitation of the draft persistence model and is not addressed here.
