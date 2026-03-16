# Goal-Time-Driven Default Running Days

**Date:** 2026-03-16
**Status:** Approved

---

## Overview

The onboarding "Which Days" step currently defaults to a hardcoded 6-day running week regardless of the user's goal time. This spec describes changes to derive that default from the user's goal time, producing a more appropriate starting point for each athlete type. A copy change to the goal time step is also included to better reflect the "no goal time" option.

---

## Problem

The current 6-day default is calibrated for advanced runners. A first-time marathoner who selects "I just want to finish" or enters a 4:30 goal sees the same default as someone chasing a 2:50. This creates friction — beginners may feel the plan is too demanding before they've even built it.

---

## Changes

### 1. `step-which-days.tsx` — Derive default from goal time

**Current behavior:** Initial preset is hardcoded to 6 days (`PRESET_DEFAULTS[6]`).

**New behavior:** Compute the initial day count from the goal time already captured in step 2.

**Logic:**

| Condition | Default days |
|---|---|
| Goal time provided, sub-2:45 full (< 165 min) | 7 |
| Goal time provided, 2:45–3:45 full (< 225 min) | 6 |
| Goal time provided, 3:45+ full (≥ 225 min) | 5 |
| No goal time ("I don't have a goal time") | 4 |

The day count is derived by calling `computeTrainingStructure(goalMinutes, distance, 7, "40-60")` from `@workspace/ai` and reading its `runDaysPerWeek` output. Passing `selectedDaysCount: 7` ensures no clamping occurs and returns the pure recommendation. The `"40-60"` mileage value is a dummy — it only affects the no-goal-time fallback path, which is handled separately (hardcoded to 4 days).

The half marathon table in `computeTrainingStructure` maps to equivalent day counts by pace bucket, so this logic generalizes correctly to half marathon distances.

**Preset tab behavior:** The existing preset tabs (5, 6, 7) remain unchanged. When the computed default is 4, no preset tab is active and the 4 days are individually toggled. The user can override any default freely.

**Imports:** `computeTrainingStructure` is imported from `@workspace/ai`, which is already a dependency of `apps/web`.

### 2. `step-goal-time.tsx` — Copy change

**Current:** "I just want to finish"
**New:** "I don't have a goal time"

This phrasing is more accurate — it describes the user's data state rather than their race ambition, and avoids implying the platform is only for competitive runners.

---

## Out of Scope

- Preset tab counts (5/6/7) are not changed
- Long run day default (Sunday) is not changed
- Downstream plan generation logic is not changed
- No new UI elements or states are introduced

---

## Files Changed

| File | Change |
|---|---|
| `apps/web/components/onboarding/steps/step-which-days.tsx` | Import `computeTrainingStructure`; replace hardcoded 6-day default with computed value |
| `apps/web/components/onboarding/steps/step-goal-time.tsx` | Update copy: "I just want to finish" → "I don't have a goal time" |
