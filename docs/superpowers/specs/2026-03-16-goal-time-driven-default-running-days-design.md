# Goal-Time-Driven Default Running Days + Onboarding Mobile Layout

**Date:** 2026-03-16
**Status:** Approved

---

## Overview

Four related changes to the onboarding flow:

1. The "Which Days" step derives its default running day count from the user's goal time rather than hardcoding 6 days.
2. A contextual message explains the recommendation to the user.
3. Onboarding step content is vertically centered on mobile.
4. The "I just want to finish" copy in the goal time step is updated.

---

## Problem

The current 6-day default is calibrated for advanced runners. A beginner or slower runner sees the same default as someone chasing a 2:50, which creates friction. There's also no explanation of why the default was chosen.

On mobile, onboarding step content uses `items-start`, which top-aligns content. When content is short (e.g., the goal time inputs), there is a large empty space below. The content should be vertically centered.

---

## Changes

### 1. `step-which-days.tsx` — Derive default from goal time

**Current behavior:** Initial preset hardcoded to 6 days (`PRESET_DEFAULTS[6]`).

**New behavior:** Compute the initial day count from goal time and distance already captured in earlier steps. The computed default applies **only when `formData.selectedDays` is undefined** (first visit). On back-navigation, `formData.selectedDays` is already set and is used directly — no computation runs.

**Logic (first visit only):**

```
distance = formData.race?.distance   // "full" | "half"

if formData.race is undefined:
  defaultDays = 6  // fallback to existing behavior

else if formData.timeGoal === true && formData.goalTime is defined:
  goalMinutes = formData.goalTime.hours * 60 + formData.goalTime.minutes
  if goalMinutes > 0:
    defaultDays = computeTrainingStructure(goalMinutes, distance, 7, "40-60").runDaysPerWeek
  else:
    defaultDays = 4  // 0:00 entry treated as no goal time

else:
  defaultDays = 4  // "I don't have a goal time", or timeGoal === undefined (e.g. restored draft)
```

`computeTrainingStructure` is called with `selectedDaysCount: 7` so its internal clamp (`Math.min(run, selectedDaysCount)`) never reduces the output. The `"40-60"` mileage argument is only consulted in the function's mileage-fallback branch, which requires `goalMinutes` to be null — since we only call the function when `goalMinutes > 0`, the mileage value is never used.

**Reference: full marathon net outputs**

The function has internal thresholds at 150, 165, 190, 225, and 270 minutes. The net `runDaysPerWeek` outputs are:

| Goal time | `runDaysPerWeek` |
|---|---|
| Any value < 165 min (sub-2:45) | 7 |
| 165–224 min (2:45–3:44) | 6 |
| 225+ min (3:45+) | 5 |
| No goal time / 0:00 entry | 4 |

Note: the threshold at exactly 165 minutes returns 6 (not 7). The thresholds at 190 and 270 are internal subdivisions that both map to the same output as their neighbors.

Half marathon goal times run through a separate table inside the function and produce the same possible outputs (5, 6, or 7). No separate handling needed.

**`Preset` type and `detectPreset` changes:**

The `Preset` type must be updated from `5 | 6 | 7` to `4 | 5 | 6 | 7 | null`.

`detectPreset` is updated:
- `days.length >= 7` → `7`
- `days.length === 6` → `6`
- `days.length === 5` → `5`
- `days.length === 4` → `4`
- `days.length < 4` (including 0) → `null` (no preset highlighted)

`applyPreset` retains its existing `5 | 6 | 7` parameter type — it is never called with `4` or `null`. `PRESET_DEFAULTS` is not changed. The preset tab loop (`[5, 6, 7]`) must remain explicitly typed as `(5 | 6 | 7)[]` — not `Preset[]` — so `applyPreset`'s narrower type stays valid.

The existing `toggleDay` call `setPreset(detectPreset(next))` works unchanged — the updated `detectPreset` may now return `4` or `null`, and both result in no tab being highlighted (since `4` and `null` are never equal to `5`, `6`, or `7` in the tab highlight check `preset === p`).

**`preset` state initialization:**

- First visit (`formData.selectedDays` is undefined): initialize `preset` from `defaultDays` (which is always 4, 5, 6, or 7 — never below 4 by construction).
- Back-navigation (`formData.selectedDays` is defined): initialize `preset` by calling `detectPreset(formData.selectedDays)`, exactly as the existing code does.

**4-day initial state:** When `defaultDays` is 4, initialize:
- `selectedDays`: `["mon", "wed", "fri", "sun"]` (alternating days with Sunday long run)
- `longRunDay`: the existing `formData.longRunDay ?? LONG_RUN_DEFAULT` fallback already initializes this to `"sun"` on first visit — no additional code needed for this field
- `preset`: `4` (no preset tab highlighted)

**Imports:** `computeTrainingStructure` is imported from `@workspace/ai`.

---

### 2. `step-which-days.tsx` — Contextual recommendation message

A short line is shown below the heading ("Set up your running week.") explaining the default. The condition mirrors the `formData.selectedDays` gate used for default computation.

**Message format:**

| Condition | Message |
|---|---|
| `formData.selectedDays` is undefined AND goal time provided | "Based on your goal of [H:MM], we recommend a [N]-day running schedule." |
| `formData.selectedDays` is undefined AND no goal time | "We've started you with a 4-day schedule — easy to adjust from here." |
| `formData.selectedDays` is defined (back-navigation) | No message shown |

Goal time is formatted as `H:MM` where minutes are always zero-padded to two digits (e.g., `3:05`, `2:50`, `0:52`). Hours are always shown, even when 0. `N` is `defaultDays`.

The message is static — it does not update live as the user toggles days. The existing subtitle ("Most advanced runners train 6 days a week. Adjust to fit your schedule.") is removed and replaced by this message.

---

### 3. Mobile layout — vertical centering for all onboarding steps

**Current state:** The step container in `onboarding-flow.tsx` uses `items-start md:items-center`, centering content on desktop but top-aligning on mobile.

**Change:** Replace `items-start md:items-center` with `items-center` (removing the now-redundant `md:` breakpoint prefix). No other layout classes change. Individual step layouts and internal spacing are not affected.

---

### 4. `step-goal-time.tsx` — Copy change

**Current:** "I just want to finish"
**New:** "I don't have a goal time"

---

## Out of Scope

- Preset tab counts (5/6/7) are not changed (4 is only an initial state, not a selectable preset)
- Long run day default (Sunday) is not changed
- Downstream plan generation logic is not changed
- The recommendation message does not update dynamically as the user toggles days

---

## Files Changed

| File | Change |
|---|---|
| `apps/web/components/onboarding/steps/step-which-days.tsx` | Import `computeTrainingStructure`; compute default days; update `Preset` type and `detectPreset`; add contextual message; remove old subtitle |
| `apps/web/components/onboarding/steps/step-goal-time.tsx` | Update copy |
| `apps/web/components/onboarding/onboarding-flow.tsx` | Replace `items-start` with `items-center` on step container |
