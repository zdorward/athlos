# Workout Completion Tracking — Design Spec

**Date:** 2026-03-14
**Status:** Approved

---

## Overview

Users can mark individual workouts as complete. Completed workouts are visually distinct (green tint + checkmark) in the plan calendar, plan feed, and dashboard. The dashboard's "Next Workout" forward-scan automatically skips completed days, advancing the hero to the next incomplete workout.

---

## Data Model

### `WorkoutDay` type change

Add an optional `completed` field to the existing `WorkoutDay` interface in `packages/ai/src/types.ts`:

```typescript
export interface WorkoutDay {
  date: string
  type: WorkoutType
  distanceKm?: number
  description: string
  completed?: boolean   // NEW — undefined and false are both treated as incomplete
}
```

No database migration required — `days` is already a JSONB column. Existing plans without the field behave as all-incomplete.

### Completion granularity

Completion is tracked per `(date, type)` pair. `(date, type)` is treated as a unique composite key within a plan — the system does not support two entries with the same date and type on the same plan. On days with multiple entries (e.g. a run and a strength session), each entry has its own `completed` flag and is marked independently. A date is considered "fully complete" only when every non-rest entry on that date has `completed === true`.

---

## API

### `PATCH /api/plans/[id]`

New route handler added to `apps/web/app/api/plans/[id]/route.ts`.

**Auth:** Requires session. Returns 401 if no session.

**Request body:**
```typescript
{
  date: string       // ISO "YYYY-MM-DD"
  type: WorkoutType  // identifies which entry to update (unique per date within a plan)
  completed: boolean
}
```

**Logic:**
1. Validate UUID format of `id` (same regex as existing GET handler).
2. Fetch the plan from DB, verifying `id` and `userId` match (same ownership check as existing GET).
3. Return 404 if not found.
4. Return 400 if `date`, `type`, or `completed` are missing from the body.
5. Find the entry in `days` where `day.date === date && day.type === type` (first match via `Array.find`).
6. Return 404 if no matching entry found.
7. Set `completed` on that entry and write the updated `days` array back to the DB.
8. Return `{ plan }` with the full updated plan.
9. Wrap DB operations in try/catch — return 500 on error.

Note: If the request sends the same `completed` value already stored (e.g. marking complete an already-complete entry), the handler still writes the unchanged array back and returns the plan. This is a harmless no-op — no special handling required.

---

## Visual Treatment

### Plan calendar (`plan-calendar.tsx`)

A calendar cell is visually "complete" when every non-rest entry for that date has `completed === true`.

**Completed cell styling** (replaces the default `bg-card border-border` background):
```
bg-green-500/10 border-green-500/30
```

**Race-day completed:** Keep `bg-primary/12 border-primary` (race completion is significant — primary color dominates). Add the checkmark icon.

Add a `Check` icon from lucide-react (`h-3 w-3 text-green-600`) in the top-right corner of the cell, alongside the existing date number.

Completed cells remain clickable and open the detail panel (to allow marking incomplete). Selected + completed style: `bg-green-500/10 border-green-500/50`.

### Plan feed (`plan-feed.tsx`)

A feed card is visually "complete" when `day.completed === true` for that specific entry. Each entry is its own card row, so completion is shown per-entry.

**Completed card styling:**
- Left border: `border-l-4 border-l-green-500` (replaces the existing workout-type color border)
- Background: `bg-green-500/5` (instead of default `bg-card`)
- Add `Check` icon (`h-4 w-4 text-green-600`) next to the workout name

### Dashboard `WorkoutCard`

Since the forward-scan skips completed days, completed workouts will not appear as the hero under normal use. No special completed visual on the dashboard card itself.

---

## Trigger Points

### Dashboard — hero card "Done" button

Add a "Done" button to `WorkoutCard` when `variant === "hero"` and `state.kind === "workout"`.

`WorkoutCard` receives a new optional prop:
```typescript
onComplete?: () => void
```

The button is only rendered when `variant === "hero"`, `state.kind === "workout"`, and `onComplete` is provided. Not shown in preview cards or non-workout states.

**Button appearance:**
```tsx
<button
  onClick={onComplete}
  className="mt-3 flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-500 transition-colors"
>
  <Check className="h-3 w-3" />
  Done
</button>
```

The `DashboardPage` passes `onComplete` to the currently-rendered hero `WorkoutCard`. On click:
1. Optimistically update `plan.days` in local state: use `setPlan(prev => prev && typeof prev === 'object' && prev !== 'empty' && prev !== 'error' ? { ...prev, days: updatedDays } : prev)` — shallow-spread preserving all non-days fields.
2. Send `PATCH /api/plans/[plan.id]` with `{ date, type, completed: true }`.
3. On error: revert the optimistic update by restoring the previous days array. No UI error toast in v1.

After the optimistic update, `findNextWorkoutDay` recomputes with the updated days and the hero advances.

### Plan view — `PlanDayDetail` completion toggle

`PlanDayDetail` receives a new optional prop:
```typescript
onToggleComplete?: (date: string, type: WorkoutType, completed: boolean) => void
```

Add a toggle button at the bottom of the detail panel. The button label is determined by `day.completed`: `false`/`undefined` → "Mark as complete", `true` → "Mark as incomplete".

The button only appears for non-rest workout types (`day.type !== "rest"`). It does not appear for rest days or when `onToggleComplete` is not provided.

**Multi-workout days in the calendar:** When a date has multiple non-rest entries, the calendar cell renders based on the first non-rest entry in `days` order (i.e. `byDate.get(date)?.find(e => e.type !== "rest")`). That first non-rest entry is the "primary" entry — it is passed to `PlanDayDetail` as `day`. The toggle in the detail panel acts on that primary entry only. Secondary entries (e.g. a strength session on a run day) are accessible as individual cards in the feed view, where each entry is its own row with its own tap target and toggle.

**`PlanViewPage` wiring:** `apps/web/app/plan/[id]/page.tsx` holds local `days` state (initialized from the fetched plan). It passes `onToggleComplete` to both `PlanCalendar` and `PlanFeed`, which each forward it to their `PlanDayDetail` instance. On toggle:
1. Optimistically update local `days` state: `setDays(prev => prev.map(d => d.date === date && d.type === type ? { ...d, completed } : d))`.
2. Send `PATCH /api/plans/[plan.id]`.
3. On error: revert to previous `days`. No UI error toast in v1.

---

## Dashboard Forward-Scan Update

`findNextWorkoutDay` in `apps/web/app/dashboard/page.tsx` currently adds a date to `seen` when any entry satisfies `day.date >= fromDateISO && day.type !== "rest"`. Update the condition to also require `!day.completed`:

```typescript
if (day.date >= fromDateISO && day.type !== "rest" && !day.completed) {
  seen.add(day.date)
}
```

This means a date is added to `seen` only if at least one non-rest entry on that date is still incomplete. Once all non-rest entries for a date are marked complete, none of them trigger `seen.add()` for that date, and the date is skipped by the scan. This achieves the "date skipped when fully complete" behavior implicitly through the per-entry guard.

---

## Files Changed

| File | Change |
|---|---|
| `packages/ai/src/types.ts` | Add `completed?: boolean` to `WorkoutDay` |
| `apps/web/app/api/plans/[id]/route.ts` | Add `PATCH` handler |
| `apps/web/app/plan/plan-day-detail.tsx` | Add `onToggleComplete` prop + toggle button |
| `apps/web/app/plan/plan-calendar.tsx` | Green cell styling for completed days; pass `onToggleComplete` to `PlanDayDetail` |
| `apps/web/app/plan/plan-feed.tsx` | Green card styling for completed entries; pass `onToggleComplete` to `PlanDayDetail` |
| `apps/web/app/plan/[id]/page.tsx` | Hold local `days` state, wire `onToggleComplete`, send PATCH, handle revert |
| `apps/web/app/dashboard/workout-card.tsx` | Add `onComplete` prop + "Done" button |
| `apps/web/app/dashboard/page.tsx` | Wire PATCH, optimistic update, update `findNextWorkoutDay` |

---

## Out of Scope

- Completion tracking on the plan generation page (`/plan`) — plan is being created, not executed
- Completion history / statistics
- Partial completion (e.g. "ran 8km of a 10km easy run")
- Push notifications when a workout is due
- Error toasts on failed PATCH (silent revert in v1)
