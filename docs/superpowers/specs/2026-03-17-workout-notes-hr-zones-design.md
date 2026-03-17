# Workout Notes and HR Zones Design

**Date:** 2026-03-17
**Status:** Approved

## Overview

Add static workout notes and HR zone labels to the day detail view. Display-layer only — no schema changes, no scheduler changes.

---

## Changes

### `apps/web/app/plan/workout-utils.ts`

**New function: `getWorkoutNote(day: WorkoutDay, units: "km" | "miles"): string`**

Returns a static instructional note for each workout type. For progression runs, computes the MP segment distance from `day.distanceKm * 0.25`, formatted in the user's units. Falls back to a generic string if `distanceKm` is undefined.

| Type | Note |
|------|------|
| easy | "Keep it genuinely easy — conversational pace throughout." |
| long | "Easy effort throughout. Protect your quality sessions." |
| progression | "Last {X} at marathon pace." where X = `distanceKm * 0.25`, formatted using the existing `formatDistance(distanceKm * 0.25, units)` + `distanceUnit(units)` utilities (e.g. "Last 8 km at marathon pace." or "Last 5 mi at marathon pace."). Standard `formatDistance` rounding applies. |
| medium-long | "Comfortably aerobic — slightly harder than easy." |
| mp | "Marathon pace throughout — race-specific effort." |
| tempo | "Comfortably hard — lactate threshold pace." |
| intervals | "Hard efforts with full recovery between reps." |
| strength | "Heavy resistance training after your run — compound lifts at ≥80% 1RM. Focus: squats, deadlifts, single-leg work. Plyometrics optional as a complement." |
| rest | "Full recovery day." |
| race | "Race day. Start conservative — first half at goal pace, finish strong if you have it." |
| shakeout | "Short shakeout to activate your legs. Keep it easy — you're not training today." |

Progression fallback (no `distanceKm`): `"Last 25–30% at marathon pace."` — used when `distanceKm` is undefined.

**New function: `getHRZone(type: WorkoutType): string`**

Returns a static zone label. Returns `"—"` for types where HR targeting is not applicable.

| Type | Zone |
|------|------|
| easy | "Zone 1" |
| long | "Zone 1" |
| progression | "Zone 1 / Zone 3 finish" |
| medium-long | "Zone 1–2" |
| mp | "Zone 3" |
| tempo | "Zone 3–4" |
| intervals | "Zone 4–5" |
| strength | "—" |
| rest | "—" |
| race | "Zone 3" |
| shakeout | "Zone 1" |

---

### `apps/web/app/plan/plan-day-detail.tsx`

Two additions to the view (non-edit) mode:

1. **Note** — rendered below the workout name (`<h2>`), before the distance block. Small muted text (`text-sm text-muted-foreground`). Uses `getWorkoutNote(day, units)`. Not shown for rest days.

2. **HR Zone** — the existing "Target HR Zone" field shows `day.targetHR ?? getHRZone(day.type)` instead of `day.targetHR ?? "—"`. User-edited values still take precedence.

---

## Out of Scope

- Personalized bpm ranges (requires max HR collection)
- Notes in plan feed or calendar cells
- User-editable notes field
