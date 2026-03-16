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

| Condition | Clears days? |
|---|---|
| `timeGoal` boolean changed (e.g. had a time, now "no goal time") | Yes |
| `timeGoal` is true and `hours` or `minutes` changed | Yes |
| Goal time submitted with same value as before | No — preserve existing days |
| `formData.selectedDays` was never set (first visit) | No — nothing to clear |

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
