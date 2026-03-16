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

One row per logged workout. Unique constraint on `(planId, workoutDate, workoutType)` — one log per workout per plan. If a user re-submits feedback for the same workout, the API returns the existing log (idempotent upsert by `(planId, workoutDate, workoutType)`); the most recent submission wins.

> **Note on multiple workouts per date:** A plan can have two workouts on the same date (e.g., a run + strength on the same day). `workoutType` is therefore part of the unique key and must be included in the log request body to identify which workout is being logged.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `userId` | text → user.id | cascade delete |
| `planId` | uuid → plans.id | cascade delete |
| `workoutDate` | text | ISO date, matches `WorkoutDay.date` |
| `workoutType` | text | `WorkoutType` enum value — part of unique key |
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
| `reason` | text | Human-readable explanation shown to athlete (see templates below) |
| `targetDate` | text | ISO date of the workout being modified |
| `originalWorkout` | jsonb | Snapshot of `WorkoutDay` before change — includes `type` for unambiguous lookup |
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
Body: { workoutType, actualEffort, completed, soreness }
```

`workoutType` is required in the request body to unambiguously identify which workout on that date is being logged.

The handler:
1. Looks up the `WorkoutDay` in `plans.days` matching `workoutDate` + `workoutType`; returns `404` if not found
2. Derives `expectedEffort` from `workoutType`
3. Upserts a `workout_logs` row on `(planId, workoutDate, workoutType)` — most recent submission wins
4. Runs the adaptation check synchronously (lightweight, last 7 days)
5. If a suggestion is generated, writes it to `adaptation_suggestions` and returns it in the response
6. Returns `200 { log, suggestion: AdaptationSuggestion | null }`

**Error responses:**
- `404` — plan not found, or no workout at this date + type
- `401` — unauthenticated
- `403` — plan does not belong to this user

No background jobs needed at this scale.

---

## Adaptation Trigger Rules

Runs after every log submission. Generates at most one pending suggestion per plan.

**Trigger conditions (either):**
- 2+ workouts in the last 7 calendar days where `actualEffort = "hard"` AND `expectedEffort != "hard"` (unexpectedly hard)
- OR: `soreness = "significant"` on two logs where both `workoutDate` values fall within any 3-calendar-day span (i.e., the dates are ≤ 3 days apart, regardless of how many workouts were logged between them)

**Exclusions:**
- Workouts where `expectedEffort = "hard"` are excluded from the unexpectedly-hard count — a hard tempo is a success, not a flag
- Rest days and race days are excluded from both trigger conditions and from replacement generation (see below)

**Incomplete workouts (`completed: false`):** Included in trigger counts. A DNF with `actualEffort = "hard"` is a meaningful load signal and should count toward the unexpectedly-hard tally.

**No stacking:** If a `pending` suggestion already exists for this plan, skip generation entirely.

**Reason templates:**

| Trigger | Template |
|---|---|
| Unexpectedly hard count | `"You've had {n} unexpectedly hard sessions in the last 7 days."` |
| Significant soreness window | `"You've reported significant soreness before multiple sessions this week."` |

---

## Proposed Workout Generation

Rules-based (not AI). Fast, cheap, predictable. Race days and rest days are never replaced.

| Original type | Replacement details |
|---|---|
| tempo | Easy run, same duration estimate |
| intervals | Easy run, same duration estimate |
| mp | Easy run, same duration estimate |
| long | Medium-long at easy pace, ~70% of original distance |
| medium-long | Easy run, same distance |
| strength | Rest day with mobility note |
| easy | Excluded — already the lightest load; counts toward trigger but not replaced |
| race | Excluded — never replaced |
| rest | Excluded — never a target |

The replacement `WorkoutDay` is constructed in code: same `date`, new `type`, adjusted `distanceKm`, updated `description`, `targetPace` cleared, `targetHR` set to `"Zone 2 (130–145 bpm)"`.

The accept handler matches the `WorkoutDay` to replace by `targetDate` AND `originalWorkout.type` (from the snapshot) — not by date alone.

---

## Suggestion Presentation & Approval

When a `pending` suggestion exists, a card appears on the dashboard above the next workout. Non-blocking.

**Card content:**
- Reason: `suggestion.reason` (from templates above)
- What's changing: original workout → proposed replacement
- Actions: **Accept** / **Keep original**

**Accept:**
```
PATCH /api/plans/[id]/suggestions/[suggestionId]/accept
```
- Sets `status = "accepted"`, `resolvedAt = now()`
- Finds the `WorkoutDay` in `plans.days` matching `targetDate` + `originalWorkout.type`; replaces it with `proposedWorkout`
- Returns `200` with updated plan
- If already accepted or dismissed: returns `200` idempotently (no-op)

**Dismiss:**
```
PATCH /api/plans/[id]/suggestions/[suggestionId]/dismiss
```
- Sets `status = "dismissed"`, `resolvedAt = now()`
- No plan mutation
- If already accepted or dismissed: returns `200` idempotently (no-op)

**Error responses (both endpoints):**
- `404` — suggestion not found
- `403` — suggestion does not belong to this user's plan
- `401` — unauthenticated

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
