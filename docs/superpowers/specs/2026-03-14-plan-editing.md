# Plan Editing — Design Spec

**Date:** 2026-03-14
**Status:** Approved

---

## Overview

Users can edit individual workout days directly from the `PlanDayDetail` panel. An "Edit" button swaps the view content with an inline form. Edits are saved via an extended `PATCH /api/plans/[id]` endpoint and applied optimistically to local state.

---

## Data Model

### `WorkoutDay` type changes

Add two optional fields to the existing `WorkoutDay` interface in `packages/ai/src/types.ts`:

```typescript
export interface WorkoutDay {
  date: string
  type: WorkoutType
  distanceKm?: number
  description: string
  completed?: boolean
  targetHR?: string    // free text, e.g. "Zone 2 (130–145 bpm)"
  targetPace?: string  // free text, e.g. "5:30–6:00/km"
}
```

Both fields are free text — pace and HR zones are personal and unit-dependent. No DB migration required; `days` is already a JSONB column.

---

## API

### `PATCH /api/plans/[id]` — extended

The existing handler already supports `{ date, type, completed }` for completion toggling. Extend it to also support a second body shape for field updates:

**New body shape:**
```typescript
{
  date: string        // ISO "YYYY-MM-DD" — identifies the entry
  type: WorkoutType   // identifies the entry (original type, before any type change)
  update: {
    type?: WorkoutType
    distanceKm?: number | null   // null clears the field
    description?: string
    targetHR?: string
    targetPace?: string
  }
}
```

**Detection:** If `body.update` is present → field update path. If `body.completed` is defined → existing completion path. Return 400 if neither is present.

**Field update logic:**
1. Same auth (401), UUID validation (404), ownership check (404) as existing handler.
2. Find entry: `days.find(d => d.date === date && d.type === type)`. Return 404 if not found.
3. Apply all fields present in `update` to the entry. For `distanceKm`: if value is `null`, delete the property; otherwise set it.
4. Write updated `days` array back to DB.
5. Return `{ plan }` with full updated plan.
6. Wrap in try/catch — return 500 on error.

**Note:** The `date`+`type` pair identifies the original entry. If `update.type` differs from the lookup `type`, the entry's type is updated in place (the entry keeps its original position in the array).

---

## Edit Mode UI

### Trigger

`PlanDayDetail` renders an "Edit" button in the top-right of the header area (alongside the existing date label). Only rendered when `onSaveEdit` prop is provided and `day` is non-null.

### Edit form fields

When in edit mode, the entire panel content is replaced with a form:

| Field | Input type | Notes |
|---|---|---|
| Workout type | `<select>` | All `WorkoutType` options |
| Distance | `<input type="number">` | In user's display units. Hidden when type is "rest". Stored as km. |
| Description | `<textarea>` | |
| Target HR Zone | `<input type="text">` | Free text |
| Target Pace | `<input type="text">` | Free text |

**Type → rest behaviour:** When the user selects "rest" from the type dropdown, the distance field hides and its form value clears (set to empty string / undefined). When switching back to any non-rest type, the distance field reappears empty.

**Distance unit conversion:** Display value = `distanceKm * conversionFactor` (km: ×1, miles: ×0.621371). On save, convert back to km before sending to API.

**Bottom of form:** "Save" button (primary action) and "Cancel" text link. Cancel returns to view mode with no changes applied. Save triggers the save flow below.

### Form state

Edit form state is local to `PlanDayDetail` (controlled inputs initialized from `day` props on mount / when edit mode opens). The parent is not involved until Save is clicked.

---

## Props

### `PlanDayDetail` new prop

```typescript
onSaveEdit?: (
  date: string,
  originalType: WorkoutType,
  update: {
    type?: WorkoutType
    distanceKm?: number | null
    description?: string
    targetHR?: string
    targetPace?: string
  }
) => void
```

The "Edit" button and form only render when `onSaveEdit` is provided.

### `PlanCalendar` and `PlanFeed`

Both accept `onSaveEdit` as a new optional prop and forward it to their `PlanDayDetail` instance.

---

## Save Flow (`PlanViewPage`)

`PlanViewPage` (`apps/web/app/plan/[id]/page.tsx`) implements `handleSaveEdit`:

1. Optimistically update local `days` state: map over `days`, find entry by `(date, originalType)`, spread in `update` fields (delete `distanceKm` if value is `null`).
2. Send `PATCH /api/plans/${plan.id}` with `{ date, type: originalType, update }`.
3. On error: revert `days` to previous snapshot. No error toast in v1.

After save, `PlanDayDetail` returns to view mode (the parent re-renders with updated `days`, which updates the `day` prop passed to `PlanDayDetail`; edit mode state resets).

---

## View Panel Updates

Once `targetHR` and `targetPace` are available on `WorkoutDay`, the existing "Target HR Zone" and "Target Pace" sections in view mode display the stored value instead of `—`.

---

## Files Changed

| File | Change |
|---|---|
| `packages/ai/src/types.ts` | Add `targetHR?: string` and `targetPace?: string` to `WorkoutDay` |
| `apps/web/app/api/plans/[id]/route.ts` | Extend PATCH handler with field update path |
| `apps/web/app/plan/plan-day-detail.tsx` | Add edit mode: Edit button, form fields, Save/Cancel, `onSaveEdit` prop |
| `apps/web/app/plan/plan-calendar.tsx` | Accept and forward `onSaveEdit` to `PlanDayDetail` |
| `apps/web/app/plan/plan-feed.tsx` | Accept and forward `onSaveEdit` to `PlanDayDetail` |
| `apps/web/app/plan/[id]/page.tsx` | Implement `handleSaveEdit`, wire to calendar and feed |

---

## Out of Scope

- Editing from the dashboard (dashboard shows next workout only, not a full editing surface)
- Adding or deleting workout days (only editing existing entries)
- Bulk editing (editing multiple days at once)
- Undo/redo history
- Validation beyond basic type-checking (e.g. warning if distance seems unrealistic)
- Error toasts on failed save (silent revert in v1)
