# Remove Adaptation Logic

**Date:** 2026-03-17
**Status:** Approved

## Overview

Remove the entire adaptive training system from Athlos. This includes the workout feedback flow, suggestion engine, DB tables, API routes, and all related UI components. Workout completion becomes a single tap — no feedback prompts, no adaptation suggestions.

## What Gets Deleted

### plan-engine package
- `packages/plan-engine/src/adaptation.ts` — core trigger/replacement logic (`deriveExpectedEffort`, `checkAdaptationTrigger`, `buildReplacementWorkout`)
- `packages/plan-engine/src/adaptation.test.ts` — 18-case test suite
- Remove `export * from "./adaptation"` from `packages/plan-engine/src/index.ts`
- Remove exported types: `ExpectedEffort`, `ActualEffort`, `Soreness`, `WorkoutLogInput`, `AdaptationTriggerResult`

### Server / API
- `apps/web/lib/run-adaptation-check.ts` — DB orchestration layer
- `apps/web/app/api/plans/[id]/workouts/[date]/log/route.ts` — POST feedback endpoint
- `apps/web/app/api/plans/[id]/suggestions/[suggestionId]/accept/route.ts`
- `apps/web/app/api/plans/[id]/suggestions/[suggestionId]/dismiss/route.ts`

### UI Components
- `apps/web/app/(app)/dashboard/workout-feedback-sheet.tsx` — feedback input UI + `AdaptationSuggestion` interface
- `apps/web/app/(app)/dashboard/adaptation-suggestion-card.tsx` — suggestion display + approval UI

### Database
- `workoutLogs` table — drop via new Drizzle migration
- `adaptationSuggestions` table — drop via new Drizzle migration

## What Gets Added / Changed

### New endpoint
`PATCH /api/plans/[id]/workouts/[date]/complete`
- Validates user session and plan ownership
- Flips `WorkoutDay.completed = true` for the matching date in `plan.days`
- Persists updated plan to DB
- Returns `{ ok: true }`

### dashboard-client.tsx
- Remove state: `feedbackEntry`, `suggestion`
- Remove handlers: `handleComplete`, `handleFeedbackLogged`, `handleSuggestionAccepted`, `handleSuggestionDismissed`
- Replace feedback-sheet open trigger with a direct call to `PATCH .../complete`
- Remove renders of `WorkoutFeedbackSheet` and `AdaptationSuggestionCard`

### DB migration
New Drizzle migration drops `workoutLogs` and `adaptationSuggestions` tables.

## Completion Model

One tap marks a workout complete. No confirmation dialog, no feedback questions, no suggestion card. The UI updates optimistically.

## Out of Scope

- Workout notes / HR zones (separate feature, different spec)
- Any future re-introduction of adaptation — this is a clean delete, not a toggle
