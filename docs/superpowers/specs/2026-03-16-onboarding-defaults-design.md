# Onboarding Defaults — Design Spec

**Date:** 2026-03-16
**Status:** Approved

---

## Overview

Pre-select sensible defaults in the onboarding day-picker steps to reduce friction for high-volume athletes. Two steps are affected: running days and lifting days. Defaults only apply when the user has not already made a selection — returning to a step preserves edits.

---

## Changes

### Running days (`StepWhichDays`)

**Running days:** `["mon", "tue", "thu", "fri", "sun"]` pre-selected when `formData.selectedDays` is empty or undefined.

**Long run day:** `"sun"` pre-selected when `formData.longRunDay` is undefined.

Rationale: Mon/Tue/Thu/Fri/Sun is the most common 5-day high-mileage pattern. Sunday long run is the overwhelming default for this audience.

### Lifting days (`StepStrengthDays`)

**Lifting days:** `["wed", "sat"]` pre-selected when `formData.strengthDays` is empty or undefined.

Rationale: Wednesday and Saturday fall on easy running days and away from the Sunday long run, making them the natural default for hybrid athletes.

---

## Behavior

- Both steps fall back to existing `formData` values when present — defaults only apply on a fresh visit (empty `formData`).
- No new UI elements added. The existing toggle controls and Next button are unchanged.

---

## Files

- Modify: `apps/web/components/onboarding/steps/step-which-days.tsx`
- Modify: `apps/web/components/onboarding/steps/step-strength-days.tsx`

---

## Out of Scope

- Defaults for other onboarding steps (trainingAge, weeklyMileage already use tap-to-advance)
- Any changes to the goal time step
- Preset shortcut buttons (e.g., "5 days", "6 days")
