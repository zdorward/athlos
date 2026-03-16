# Onboarding Defaults — Design Spec

**Date:** 2026-03-16
**Status:** Approved

---

## Overview

Pre-select sensible defaults in the onboarding day-picker steps to reduce friction for high-volume athletes. Two steps are affected: running days and lifting days. Defaults only apply on the first visit to each step (when the field has never been written to `formData`) — returning to a step after making a selection preserves the user's edits.

---

## Changes

### Running days (`StepWhichDays`)

**Running days:** `["mon", "tue", "thu", "fri", "sun"]` pre-selected when `formData.selectedDays` is `undefined` (not yet set). An explicit `[]` (user cleared all days) is preserved as-is.

**Long run day:** `"sun"` pre-selected when `formData.longRunDay` is `undefined` AND `"sun"` is present in the resolved `selectedDays`. If `"sun"` is not in `selectedDays`, `longRunDay` stays `undefined`. This guards against pre-selecting a long run day that is not in the running days list.

Rationale: Mon/Tue/Thu/Fri/Sun is the most common 5-day high-mileage pattern. Sunday long run is the overwhelming default for this audience.

**Immediate Next enablement:** With defaults applied, `selectedDays` is non-empty and `longRunDay` is set, so the Next button is immediately enabled on arrival. This is intentional.

### Lifting days (`StepStrengthDays`)

**Lifting days:** `["wed", "sat"]` pre-selected when `formData.strengthDays` is `undefined` (not yet set). An explicit `[]` is preserved as-is.

Rationale: Wednesday and Saturday fall on easy running days and away from the Sunday long run, making them the natural default for hybrid athletes.

**Immediate Next enablement:** With defaults applied, the Next button is immediately enabled on arrival. This is intentional.

---

## Behavior

- Defaults fire only when the `formData` field is `undefined` — the field has never been written. An empty array `[]` means the user explicitly cleared their selection and is preserved.
- Returning to a step after making a selection preserves the user's choices — `formData` will be populated, so defaults do not re-apply.
- The strengthDays step is only reachable when `formData.strengthTraining === true` — this is unchanged.

---

## Files

- Modify: `apps/web/components/onboarding/steps/step-which-days.tsx`
- Modify: `apps/web/components/onboarding/steps/step-strength-days.tsx`

---

## Out of Scope

- Defaults for other onboarding steps (trainingAge, weeklyMileage already use tap-to-advance)
- Any changes to the goal time step
- Preset shortcut buttons (e.g., "5 days", "6 days")
