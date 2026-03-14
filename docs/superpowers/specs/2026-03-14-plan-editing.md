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

**Detection:** Replace the existing body validation guard entirely with a branch check:
- If `body.update` is present → field update path (described below).
- Else if `body.completed` is defined → completion path: validate that `body.date` and `body.type` are also present (return 400 if not), then follow the existing completion logic.
- Else → return 400.

Do not extend the old guard — replace it with this branch.

**Field update logic:**
1. Same auth (401), UUID validation (404), ownership check (404) as existing handler.
2. Find entry: `days.find(d => d.date === date && d.type === type)`. Return 404 if not found.
3. Apply all fields present in `update` to the entry:
   - For `distanceKm`: if `update.distanceKm === null`, delete the property from the entry (`delete entry.distanceKm`); if it's a number, set it; if absent from `update`, leave unchanged.
   - For all other fields (`type`, `description`, `targetHR`, `targetPace`): if present in `update`, set on entry; if absent, leave unchanged.
4. Write updated `days` array back to DB.
5. Return `{ plan }` with full updated plan.
6. Wrap in try/catch — return 500 on error.

**Note:** The `date`+`type` pair identifies the original entry. If `update.type` differs from the lookup `type`, the entry's type is updated in place (the entry keeps its original position in the array). An empty string for `description` is valid and accepted — no minimum-length validation in v1.

---

## Edit Mode UI

### Trigger

`PlanDayDetail` renders an "Edit" button alongside the existing date label. Wrap the existing date `<p>` and the new Edit `<button>` in a `flex items-center justify-between` row. Place this flex row **below** the existing Close button (the Close button row remains at the top, unchanged). The Edit button only renders when `onSaveEdit` is provided and `day` is non-null. When both `onClose` and `onSaveEdit` are present (e.g. in `PlanFeed`), the Close button appears first, then the date/Edit row beneath it — they do not share a row.

### Edit form fields

When in edit mode, the entire panel content is replaced with a form:

| Field | Input type | Notes |
|---|---|---|
| Workout type | `<select>` | Use the keys of `WORKOUT_NAMES` from `workout-utils` as option values; use the corresponding display name as the label |
| Distance | `<input type="number">` | In user's display units. Hidden when type is "rest". Stored as km. |
| Description | `<textarea>` | |
| Target HR Zone | `<input type="text">` | Free text |
| Target Pace | `<input type="text">` | Free text |

**Type → rest behaviour:** When the user selects "rest" from the type dropdown, the distance field hides and its form value clears (set to empty string / undefined). When switching back to any non-rest type, the distance field reappears empty.

**Distance unit conversion:** `formatDistance` in `workout-utils` returns a formatted string and cannot be used for round-trip arithmetic. Inline `const KM_TO_MILES = 0.621371` in `PlanDayDetail`. Use the existing `units` prop (already present on `PlanDayDetail`) — no new prop required. Display value = `distanceKm * (units === "miles" ? KM_TO_MILES : 1)`. On save, convert back: `displayValue / (units === "miles" ? KM_TO_MILES : 1)`.

**Bottom of form:** "Save" button (primary action) and "Cancel" text link. Cancel returns to view mode with no changes applied. Save triggers the save flow below.

### Form state

Edit form state is local to `PlanDayDetail` (controlled inputs initialized from `day` props on mount / when edit mode opens). The parent is not involved until Save is clicked.

Each time edit mode is entered, form state is re-initialized from the current `day` prop values. This ensures that if the user opens edit, cancels, and opens again, they see the latest saved values — not stale in-progress state.

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

**Mode reset:** `PlanDayDetail` does not await the async save result. It returns to view mode immediately when the user clicks Save (optimistic). The parent's re-render (from updated `days`) will update the `day` prop naturally. If the save fails and `days` reverts, the displayed values will revert too. `handleSaveEdit` in `PlanViewPage` should be a regular (non-async) function that fires the fetch without awaiting — this satisfies the `(...args) => void` return type (the function returns `void`; it just doesn't `await` internally) and avoids TypeScript friction.

### `PlanCalendar` and `PlanFeed`

Both accept `onSaveEdit` as a new optional prop and forward it to their `PlanDayDetail` instance.

Both components must expose `selectedKey` and `onSelectedKeyChange` as controlled props (replacing their current internal `useState`). In both components, replace all existing `setSelectedKey(...)` call sites — cell/card click handlers, close-button handlers, and (for `PlanFeed` only) backdrop taps — with `onSelectedKeyChange(...)`. `PlanCalendar` has no backdrop; the backdrop-dismiss case applies to `PlanFeed` only.

---

## Save Flow (`PlanViewPage`)

`PlanViewPage` (`apps/web/app/plan/[id]/page.tsx`) implements `handleSaveEdit`:

1. Snapshot previous `days` for revert.
2. Optimistically update local `days` state: map over `days`, find entry by `(date, originalType)`, then:
   - If `update.distanceKm === null`: build the updated entry **without** `distanceKm` (omit the property, do not set it to null).
   - Otherwise: spread `update` fields onto the entry normally.
3. If `update.type` differs from `originalType`, update the selection key: call `setSelectedKey({ date, type: update.type })`. Use a **single** `selectedKey` / `setSelectedKey` state in `PlanViewPage`, shared between `PlanCalendar` and `PlanFeed`. Since only one is mounted at a time (desktop vs. mobile), sharing the state is safe and `handleSaveEdit` can update it directly. Without this, a type change causes `selectedKey.type` to no longer match any entry and the detail panel goes blank.
4. Send `PATCH /api/plans/${plan.id}` with `{ date, type: originalType, update }`.
5. On error: revert `days` to previous snapshot and revert `selectedKey` to `{ date, type: originalType }`. No error toast in v1.

After `handleSaveEdit` is called, `PlanDayDetail` switches back to view mode immediately (see mode reset above).

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
| `apps/web/app/plan/plan-calendar.tsx` | Accept and forward `onSaveEdit` to `PlanDayDetail`; expose `selectedKey`/`onSelectedKeyChange` as controlled props |
| `apps/web/app/plan/plan-feed.tsx` | Accept and forward `onSaveEdit` to `PlanDayDetail`; expose `selectedKey`/`onSelectedKeyChange` as controlled props |
| `apps/web/app/plan/[id]/page.tsx` | Implement `handleSaveEdit`, wire to calendar and feed; control selection keys |

---

## Out of Scope

- Editing from the dashboard (dashboard shows next workout only, not a full editing surface)
- Adding or deleting workout days (only editing existing entries)
- Bulk editing (editing multiple days at once)
- Undo/redo history
- Validation beyond basic type-checking (e.g. warning if distance seems unrealistic)
- Error toasts on failed save (silent revert in v1)
- Multi-workout-day type-change edge case in `PlanCalendar` (when the edited entry is one of several on the same day, a type change may invalidate the primary-entry heuristic; this edge case is accepted and not handled in v1)
