# Adaptive Training — Design Spec

**Date:** 2026-03-16
**Status:** Approved

---

## Overview

Add adaptive training to Athlos: after each workout, the athlete logs how it felt and their soreness level. The system detects unexpectedly hard load over a rolling 7-day window and proposes a specific swap for the next affected workout. The athlete approves or dismisses — the plan never changes silently.

This version uses manual feedback only (no device integration). Designed to extend cleanly toward Strava/Garmin and multi-week adaptation later.

---

## Data Model

### `workout_logs`

One row per logged workout.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `userId` | text → user.id | cascade delete |
| `planId` | uuid → plans.id | cascade delete |
| `workoutDate` | text | ISO date, matches `WorkoutDay.date` |
| `workoutType` | text | `WorkoutType` enum value |
| `expectedEffort` | text | `"hard" \| "moderate" \| "easy"` — derived from `workoutType` at log time |
| `actualEffort` | text | `"hard" \| "good" \| "easy"` — athlete input |
| `completed` | boolean | whether the athlete finished the workout |
| `soreness` | text | `"none" \| "mild" \| "significant"` — pre-workout legs |
| `loggedAt` | timestamp | server time |

**`expectedEffort` derivation:**
- `"hard"`: tempo, intervals, mp, race
- `"moderate"`: long, medium-long
- `"easy"`: easy, strength, rest

### `adaptation_suggestions`

One row per generated suggestion. At most one `pending` suggestion per plan at a time.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `userId` | text → user.id | |
| `planId` | uuid → plans.id | |
| `status` | text | `"pending" \| "accepted" \| "dismissed"` |
| `reason` | text | Human-readable explanation shown to athlete |
| `targetDate` | text | ISO date of the workout being modified |
| `originalWorkout` | jsonb | Snapshot of `WorkoutDay` before change |
| `proposedWorkout` | jsonb | Suggested replacement `WorkoutDay` |
| `createdAt` | timestamp | |
| `resolvedAt` | timestamp | nullable; set on accept or dismiss |

---

## Feedback Collection Flow

After a workout is marked complete, a feedback sheet slides up with two questions:

1. **How did that feel?** — Hard / Good / Easy → `actualEffort`
2. **How are your legs going into today?** — Fresh / Mild soreness / Pretty beat up → `soreness: none | mild | significant`

The sheet is dismissible — never blocks the athlete. If dismissed, the workout is still marked complete but no log row is written.

**API endpoint:**
```
POST /api/plans/[id]/workouts/[date]/log
Body: { actualEffort, completed, soreness }
```

The handler:
1. Derives `expectedEffort` from the `workoutType` for that date
2. Inserts a `workout_logs` row
3. Runs the adaptation check synchronously (lightweight, last 7 days)
4. If a suggestion is generated, writes it to `adaptation_suggestions` and returns it in the response
5. Returns `{ log, suggestion: AdaptationSuggestion | null }`

No background jobs needed at this scale.

---

## Adaptation Trigger Rules

Runs after every log submission. Generates at most one pending suggestion per plan.

**Trigger conditions (either):**
- 2+ workouts in the last 7 days where `actualEffort = "hard"` AND `expectedEffort != "hard"` (unexpectedly hard)
- OR: `soreness = "significant"` on two workouts within any 3-day window

**Exclusions:**
- Workouts where `expectedEffort = "hard"` are excluded from the unexpectedly-hard count — a hard tempo is a success, not a flag
- Rest days excluded

**No stacking:** If a `pending` suggestion already exists for this plan, skip generation.

---

## Proposed Workout Generation

Rules-based (not AI). Fast, cheap, predictable.

| Original type | Replacement |
|---|---|
| tempo | easy run, same time estimate |
| intervals | easy run, same time estimate |
| mp | easy run, same time estimate |
| long | medium-long at easy pace, ~70% of original distance |
| medium-long | easy run, same distance |
| strength | rest or mobility note |

The replacement `WorkoutDay` is constructed in code: same date, new type, adjusted `distanceKm`, updated `description`, `targetPace` cleared, `targetHR` set to Zone 2 range.

---

## Suggestion Presentation & Approval

When a `pending` suggestion exists, a card appears on the dashboard above the next workout. Non-blocking.

**Card content:**
- Reason: `suggestion.reason` — e.g. "You've had 2 unexpectedly hard sessions in the last 6 days"
- What's changing: original workout → proposed replacement
- Actions: **Accept** / **Keep original**

**Accept:**
```
PATCH /api/plans/[id]/suggestions/[suggestionId]/accept
```
- Sets `status = "accepted"`, `resolvedAt = now()`
- Mutates the matching `WorkoutDay` in `plans.days` JSONB for `targetDate`
- Returns updated plan

**Dismiss:**
```
PATCH /api/plans/[id]/suggestions/[suggestionId]/dismiss
```
- Sets `status = "dismissed"`, `resolvedAt = now()`
- No plan mutation

---

## Future Extension Points

- **Strava/Garmin:** `workout_logs` gains an optional `sourceActivityId` and `externalHR` column. The feedback sheet is skipped or pre-filled when activity data is available.
- **Multi-week adaptation:** Adaptation check gets a second pass that looks at 2-week patterns and can propose a deload week by shifting plan structure.
- **Soreness context:** Pre-session soreness becomes predictive input once enough logs accumulate.

---

## Out of Scope

- Device integrations (Strava, Garmin)
- AI-generated suggestion text (reason is templated)
- Multi-week plan restructuring
- Aggregate analytics / load charts (future dashboard feature)
