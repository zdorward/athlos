# Remove Adaptation Logic

**Date:** 2026-03-17
**Status:** Approved

## Overview

Remove the entire adaptive training system from Athlos. This includes the workout feedback flow, suggestion engine, DB tables, API routes, and all related UI components. Workout completion becomes a single tap — the dashboard calls the existing `PATCH /api/plans/[id]` endpoint with `{ date, type, completed: true }`. No feedback prompts. No adaptation suggestions.

## What Gets Deleted

### plan-engine package
- `packages/plan-engine/src/adaptation.ts` — core trigger/replacement logic
- `packages/plan-engine/src/adaptation.test.ts` — 18-case test suite
- Remove `export * from "./adaptation"` from `packages/plan-engine/src/index.ts`
- Remove exported types: `ExpectedEffort`, `ActualEffort`, `Soreness`, `WorkoutLogInput`, `AdaptationTriggerResult`
- Remove `effort?: "hard" | "good" | "easy"` from `WorkoutDay` in `packages/plan-engine/src/types.ts`

### Server / API
- `apps/web/lib/run-adaptation-check.ts` — DB orchestration layer
- `apps/web/app/api/plans/[id]/workouts/[date]/log/route.ts` — POST feedback endpoint
- `apps/web/app/api/plans/[id]/suggestions/[suggestionId]/accept/route.ts`
- `apps/web/app/api/plans/[id]/suggestions/[suggestionId]/dismiss/route.ts`

### UI Components (delete the files entirely)
- `apps/web/app/(app)/dashboard/workout-feedback-sheet.tsx`
- `apps/web/app/(app)/dashboard/adaptation-suggestion-card.tsx`

### Database
- Remove `workoutLogs` table definition from `packages/db/src/schema.ts`
- Remove `adaptationSuggestions` table definition from `packages/db/src/schema.ts`
- `packages/db/src/index.ts` uses `export * from "./schema"` — no change needed; removing the definitions from `schema.ts` is sufficient
- New Drizzle migration drops both tables from the database

## What Gets Changed

### Existing `PATCH /api/plans/[id]` (`apps/web/app/api/plans/[id]/route.ts`)
- Remove `effort` from the request body type
- Remove the `body.effort` handling block (lines 148–153)
- Rename `isCompletionOrEffort` to `isCompletion` and update its check to only reference `body.completed`

### dashboard-client.tsx (`apps/web/app/(app)/dashboard/dashboard-client.tsx`)
Remove:
- Imports on lines 12–13: `WorkoutFeedbackSheet`, `AdaptationSuggestionCard`, and `type AdaptationSuggestion`
- State: `feedbackEntry`, `suggestion` (including the `AdaptationSuggestion` type annotation)
- Handlers: `handleComplete`, `handleFeedbackLogged`, `handleSuggestionAccepted`, `handleSuggestionDismissed`, `handleFeedbackDismiss`
- Renders of `WorkoutFeedbackSheet` and `AdaptationSuggestionCard`

Add/rename:
- A single `handleComplete(entry: WorkoutDay)` handler, based on the existing `handleFeedbackDismiss` logic — retain its optimistic update + fetch rollback pattern. It calls `PATCH /api/plans/[id]` with `{ date: entry.date, type: entry.type, completed: true }`, applies the optimistic update immediately, and rolls back on failure.
- Wire `handleComplete` to the `onComplete` prop of `TodayWorkoutCard`

### today-workout-card.tsx (`apps/web/app/(app)/dashboard/today-workout-card.tsx`)
- Remove the conditional effort label rendering (inside the `isComplete` block, lines 45–49) — `WorkoutDay.effort` no longer exists

### Orphaned effort data in plans.days JSONB
Some existing plan rows may have `effort` values in their `days` JSONB column (written by the log route). These are left as-is. Removing the TypeScript field is sufficient — the extra JSON key is benign and scrubbing every row via migration is disproportionate.

## Completion Model

One tap marks a workout complete. The dashboard calls the existing `PATCH /api/plans/[id]` with `{ date, type, completed: true }`. The UI updates optimistically with rollback on error. No new endpoint is needed.

## Out of Scope

- Workout notes / HR zones (separate feature, different spec)
- Any future re-introduction of adaptation — this is a clean delete, not a toggle
