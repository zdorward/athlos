# Goal-Time-Driven Default Running Days + Onboarding Mobile Layout

**Date:** 2026-03-16
**Status:** Approved

---

## Overview

Four related changes to the onboarding flow:

1. The "Which Days" step derives its default running day count from the user's goal time rather than hardcoding 6 days.
2. A 4-day preset is added to the preset selector, and the selector layout changes from a 3-tab row to a 2×2 grid.
3. A contextual message explains the recommendation to the user.
4. Onboarding step content is vertically centered on mobile.
5. The "I just want to finish" copy in the goal time step is updated.

---

## Problem

The current 6-day default is calibrated for advanced runners. A beginner or slower runner sees the same default as someone chasing a 2:50, which creates friction. There's also no 4-day preset option for lower-volume runners.

On mobile, onboarding step content uses `items-start`, which top-aligns content. When content is short (e.g., the goal time inputs), there is a large empty space below. The content should be vertically centered.

---

## Changes

### 1. `step-which-days.tsx` — Add 4-day preset and 2×2 grid layout

**`PRESET_DEFAULTS`:** Add a `4` key:

```ts
const PRESET_DEFAULTS: Record<Preset, Day[]> = {
  4: ["mon", "wed", "fri", "sun"],
  5: ["mon", "tue", "thu", "fri", "sun"],
  6: ["mon", "tue", "wed", "thu", "fri", "sun"],
  7: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
}
```

The 4-day default (`mon, wed, fri, sun`) is an alternating-day spread with Sunday as the long run day.

**`Preset` type:** Update from `5 | 6 | 7` to `4 | 5 | 6 | 7`.

**`applyPreset`:** Update parameter type to `Preset` (now `4 | 5 | 6 | 7`). No other logic changes — `PRESET_DEFAULTS[p]` now covers all four values.

**`detectPreset`:** Update to return `4` when `days.length === 4`, `null` when `days.length < 4` (no preset highlighted), and existing behavior for 5/6/7. Return type becomes `Preset | null`.

**Preset selector UI:** Extend the current 3-tab row to a single row of 4 tabs:

```
[ 4 days ]  [ 5 days ]  [ 6 days ]  [ 7 days ]
```

Same styling as the existing preset tabs. The active preset is highlighted. The row spans the full container width with equal-width buttons.

---

### 2. `step-which-days.tsx` — Derive default from goal time

**Current behavior:** Initial preset hardcoded to 6 days (`PRESET_DEFAULTS[6]`).

**New behavior:** Compute the initial day count from goal time and distance already captured in earlier steps. The computed default applies **only when `formData.selectedDays` is undefined** (first visit). On back-navigation, `formData.selectedDays` is already set and used directly — no computation runs.

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

`computeTrainingStructure` is called with `selectedDaysCount: 7` so its internal clamp (`Math.min(run, selectedDaysCount)`) never reduces the output. The `"40-60"` mileage argument is only consulted in the function's mileage-fallback branch (when `goalMinutes` is null) — since we only call the function when `goalMinutes > 0`, the mileage value is never used.

**Reference: full marathon net outputs**

| Goal time | `runDaysPerWeek` |
|---|---|
| Any value < 165 min (sub-2:45) | 7 |
| 165–224 min (2:45–3:44) | 6 |
| 225+ min (3:45+) | 5 |
| No goal time / 0:00 entry | 4 |

Note: the threshold at exactly 165 minutes returns 6 (not 7). The function has additional internal thresholds at 150, 190, and 270 minutes that are subdivisions — they don't change the `runDaysPerWeek` output relative to their neighbors.

Half marathon goal times run through a separate table inside the function and produce the same possible outputs (5, 6, or 7). No separate handling needed.

**`preset` state initialization:**

- First visit: initialize `preset` to `defaultDays` (always 4, 5, 6, or 7). Then call `applyPreset(defaultDays)` to set `selectedDays` and `longRunDay` from `PRESET_DEFAULTS`.
- Back-navigation: `formData.selectedDays` is already set; initialize `preset` via `detectPreset(formData.selectedDays)` as before. `longRunDay` comes from `formData.longRunDay ?? LONG_RUN_DEFAULT`.

**Imports:** `computeTrainingStructure` is imported from `@workspace/ai`.

---

### 3. `step-which-days.tsx` — Contextual recommendation message

A short line is shown below the heading ("Set up your running week.") explaining the default. The condition mirrors the `formData.selectedDays` gate used for default computation.

**Message format:**

| Condition | Message |
|---|---|
| `formData.selectedDays` is undefined AND goal time provided | "Based on your goal of [H:MM], we recommend a [N]-day running schedule." |
| `formData.selectedDays` is undefined AND no goal time | "We've started you with a 4-day schedule — easy to adjust from here." |
| `formData.selectedDays` is defined (back-navigation) | No message shown |

Goal time is formatted as `H:MM` where minutes are always zero-padded to two digits (e.g., `3:05`, `2:50`). Hours are always shown. `N` is `defaultDays`.

The message is static — it does not update live as the user toggles days. The existing subtitle ("Most advanced runners train 6 days a week. Adjust to fit your schedule.") is removed and replaced by this message.

---

### 4. Mobile layout — vertical centering for all onboarding steps

**Current state:** The step container in `onboarding-flow.tsx` uses `items-start md:items-center`, centering content on desktop but top-aligning on mobile.

**Change:** Replace `items-start md:items-center` with `items-center` (removing the now-redundant `md:` prefix). No other layout classes change. Individual step internal spacing is not affected.

---

### 5. `step-goal-time.tsx` — Copy change

**Current:** "I just want to finish"
**New:** "I don't have a goal time"

---

### 6. `step-which-days.tsx` — Day bubble layout

**Current:** Day-of-week bubbles are compact and don't span the full container width.

**Change:** The day bubble row uses `w-full justify-between` so the first and last bubbles align with the container edges (matching the preset row above and the Next button below). Bubble size is unchanged; the increased space is distributed as gaps between bubbles. Increase the gap slightly beyond the current value to give each bubble more breathing room.

---

## Out of Scope

- Long run day default (Sunday) is not changed
- Downstream plan generation logic is not changed
- The recommendation message does not update dynamically as the user toggles days

---

## Files Changed

| File | Change |
|---|---|
| `apps/web/components/onboarding/steps/step-which-days.tsx` | Add 4-day preset; 4-tab row UI; update `Preset` type, `detectPreset`, `applyPreset`; import `computeTrainingStructure`; compute default days; add contextual message; remove old subtitle; day bubbles `justify-between` with increased gap |
| `apps/web/components/onboarding/steps/step-goal-time.tsx` | Update copy |
| `apps/web/components/onboarding/onboarding-flow.tsx` | Replace `items-start md:items-center` with `items-center` |
