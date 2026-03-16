# Plan Editing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to edit individual workout fields (type, distance, description, target HR zone, target pace) directly from the `PlanDayDetail` panel.

**Architecture:** `PlanDayDetail` gains an inline edit mode toggled by an "Edit" button. On save, `PlanViewPage` applies an optimistic update to local `days` state and sends a `PATCH` request; it also controls the `selectedKey` shared between `PlanCalendar` and `PlanFeed` so a type change doesn't lose the selection. The PATCH handler is extended with a second body shape for field updates.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Drizzle ORM (Neon Postgres, JSONB `days` column)

---

## Chunk 1: Data Model + API

### Task 1: Add `targetHR` and `targetPace` to `WorkoutDay`

**Files:**
- Modify: `packages/ai/src/types.ts`

**Context:** `WorkoutDay` is the shared type used across the monorepo. Adding two optional string fields requires no DB migration — `days` is already a JSONB column.

- [ ] **Step 1: Add the two fields to `WorkoutDay`**

Open `packages/ai/src/types.ts`. The current interface ends at `completed?: boolean`. Add two fields after it:

```typescript
export interface WorkoutDay {
  date: string         // ISO "2026-06-16"
  type: WorkoutType
  distanceKm?: number  // always km; omitted for rest days only
  description: string
  completed?: boolean  // undefined and false are both treated as incomplete
  targetHR?: string    // free text, e.g. "Zone 2 (130–145 bpm)"
  targetPace?: string  // free text, e.g. "5:30–6:00/km"
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from repo root:
```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/types.ts
git commit -m "feat: add targetHR and targetPace fields to WorkoutDay"
```

---

### Task 2: Extend PATCH handler with field update path

**Files:**
- Modify: `apps/web/app/api/plans/[id]/route.ts`

**Context:** The existing PATCH handler at lines 41–95 handles completion toggling with the body shape `{ date, type, completed }`. The body validation guard on line 57 currently rejects any request that lacks `completed`. We need to replace that guard entirely and add a new field-update branch.

The existing handler logic (auth, UUID check, DB fetch, ownership check) is reused for both paths. Only the body parsing and entry-update logic differs.

- [ ] **Step 1: Replace the body type annotation and guard**

Find these lines in `apps/web/app/api/plans/[id]/route.ts`:

```typescript
  const body = (await req.json()) as { date?: string; type?: WorkoutType; completed?: boolean }
  if (body.date === undefined || body.type === undefined || body.completed === undefined) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }
  const { date, type, completed } = body
```

Replace with:

```typescript
  type FieldUpdate = {
    type?: WorkoutType
    distanceKm?: number | null
    description?: string
    targetHR?: string
    targetPace?: string
  }
  const body = (await req.json()) as {
    date?: string
    type?: WorkoutType
    completed?: boolean
    update?: FieldUpdate
  }

  const isFieldUpdate = body.update !== undefined
  const isCompletionToggle = !isFieldUpdate && body.completed !== undefined

  if (!isFieldUpdate && !isCompletionToggle) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }

  if (isCompletionToggle && (body.date === undefined || body.type === undefined)) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }

  if (isFieldUpdate && (body.date === undefined || body.type === undefined)) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }
```

- [ ] **Step 2: Replace the entry update logic**

Find these lines (inside the try block, after `entry` is found and checked):

```typescript
    entry.completed = completed
    await db
      .update(plans)
      .set({ days })
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))

    const [updated] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))
      .limit(1)

    return Response.json({ plan: updated })
```

Replace with:

```typescript
    if (isFieldUpdate) {
      const update = body.update!
      if (update.type !== undefined) entry.type = update.type
      if (update.description !== undefined) entry.description = update.description
      if (update.targetHR !== undefined) entry.targetHR = update.targetHR
      if (update.targetPace !== undefined) entry.targetPace = update.targetPace
      if ("distanceKm" in update) {
        if (update.distanceKm === null) {
          delete entry.distanceKm
        } else if (update.distanceKm !== undefined) {
          entry.distanceKm = update.distanceKm
        }
      }
    } else {
      entry.completed = body.completed
    }

    await db
      .update(plans)
      .set({ days })
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))

    const [updated] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))
      .limit(1)

    return Response.json({ plan: updated })
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 4: Verify lint passes**

```bash
pnpm lint
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/plans/[id]/route.ts
git commit -m "feat: extend PATCH /api/plans/[id] with field update path"
```

---

## Chunk 2: PlanDayDetail View + Edit Mode

### Task 3: Display `targetHR` and `targetPace` in view mode

**Files:**
- Modify: `apps/web/app/plan/plan-day-detail.tsx`

**Context:** Currently the "Target HR Zone" and "Target Pace" sections in `PlanDayDetail` always render `—`. Now that `WorkoutDay` has `targetHR` and `targetPace`, display the stored value when present.

- [ ] **Step 1: Update the Target HR Zone section**

Find in `apps/web/app/plan/plan-day-detail.tsx`:

```tsx
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-2">
          Target HR Zone
        </p>
        <p className="text-sm text-subtle-foreground">—</p>
      </div>
```

Replace with:

```tsx
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-2">
          Target HR Zone
        </p>
        <p className="text-sm text-subtle-foreground">{day.targetHR ?? "—"}</p>
      </div>
```

- [ ] **Step 2: Update the Target Pace section**

Find:

```tsx
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-2">
          Target Pace
        </p>
        <p className="text-sm text-subtle-foreground">—</p>
      </div>
```

Replace with:

```tsx
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-2">
          Target Pace
        </p>
        <p className="text-sm text-subtle-foreground">{day.targetPace ?? "—"}</p>
      </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/plan/plan-day-detail.tsx
git commit -m "feat: display targetHR and targetPace in plan day detail view"
```

---

### Task 4: Add edit mode to `PlanDayDetail`

**Files:**
- Modify: `apps/web/app/plan/plan-day-detail.tsx`

**Context:** `PlanDayDetail` is a "use client" component that currently has no local state. We're adding:
- `onSaveEdit` prop (optional) — when provided, the Edit button renders
- `isEditing` boolean state — toggled by Edit/Cancel
- `formState` object state — controlled inputs initialized from `day` on each edit open
- An edit form that replaces the panel content when `isEditing` is true

**Important implementation details from the spec:**
- The Edit button is in a `flex items-center justify-between` row together with the existing date `<p>`. This row sits **below** the existing Close button.
- When both `onClose` and `onSaveEdit` are present (mobile bottom sheet), the Close button appears first, then the date/Edit row beneath it.
- The type dropdown uses `Object.keys(WORKOUT_NAMES)` for option values, with `WORKOUT_NAMES[type]` as labels.
- When type is changed to `"rest"`, distance field hides and its value clears.
- Distance conversion: inline `const KM_TO_MILES = 0.621371`. Display = `distanceKm * factor`. On save, convert back.
- Each time edit mode is opened, form state re-initializes from current `day` prop (use a `useEffect` keyed on `isEditing`).
- On Save: call `onSaveEdit` with the update object, then set `isEditing(false)` — no awaiting, purely optimistic.
- The `distanceKm` field in the update should be:
  - `null` if the user cleared the field (was non-rest before, now type is rest OR user emptied the number input)
  - `number` if a valid number was entered
  - `undefined` (absent from update) if the field was already empty and remains empty (rest day that stays rest)

- [ ] **Step 1: Add `useState` import and new prop type**

At the top of `apps/web/app/plan/plan-day-detail.tsx`, update the React import to include `useState` and `useEffect`:

```tsx
import { useState, useEffect } from "react"
```

Update the `PlanDayDetailProps` interface to add `onSaveEdit`:

```typescript
interface PlanDayDetailProps {
  day: WorkoutDay | null
  units: "km" | "miles"
  onClose?: () => void
  onToggleComplete?: (date: string, type: WorkoutType, completed: boolean) => void
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
}
```

- [ ] **Step 2: Add the distance conversion constant and edit state**

At the top of the `PlanDayDetail` function body, before the early return for `!day`, add:

```typescript
const KM_TO_MILES = 0.621371

type EditForm = {
  type: WorkoutType
  distanceDisplay: string  // numeric string in display units, "" if empty
  description: string
  targetHR: string
  targetPace: string
}

const [isEditing, setIsEditing] = useState(false)
const [formState, setFormState] = useState<EditForm>({
  type: "easy",
  distanceDisplay: "",
  description: "",
  targetHR: "",
  targetPace: "",
})

// Re-initialize form state each time edit mode opens
useEffect(() => {
  if (isEditing && day) {
    setFormState({
      type: day.type,
      distanceDisplay:
        day.distanceKm != null
          ? String(+(day.distanceKm * (units === "miles" ? KM_TO_MILES : 1)).toFixed(2))
          : "",
      description: day.description,
      targetHR: day.targetHR ?? "",
      targetPace: day.targetPace ?? "",
    })
  }
}, [isEditing])  // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Restructure the view-mode date header to include the Edit button**

Find the current header block (the `<div>` containing the date `<p>` and workout title `<h2>`):

```tsx
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-1">
          {format(parseISO(day.date), "EEEE, MMM d, yyyy")}
        </p>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          {day.type === "race" && <Star className="h-5 w-5 fill-primary text-primary" />}
          <span className={textClass} style={colorStyle}>
            {WORKOUT_NAMES[day.type]}
          </span>
        </h2>
      </div>
```

Replace with:

```tsx
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
            {format(parseISO(day.date), "EEEE, MMM d, yyyy")}
          </p>
          {onSaveEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Edit
            </button>
          )}
        </div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          {day.type === "race" && <Star className="h-5 w-5 fill-primary text-primary" />}
          <span className={textClass} style={colorStyle}>
            {WORKOUT_NAMES[day.type]}
          </span>
        </h2>
      </div>
```

- [ ] **Step 4: Wrap the entire return in an edit-mode branch**

The function currently returns a single JSX block for the non-null case. We need to return the edit form when `isEditing` is true. The best approach: immediately after the `const colorStyle = ...` line and before the `return (`, add the edit mode render:

```tsx
  if (isEditing) {
    const isRest = formState.type === "rest"

    function handleSave() {
      if (!day || !onSaveEdit) return
      const update: {
        type?: WorkoutType
        distanceKm?: number | null
        description?: string
        targetHR?: string
        targetPace?: string
      } = {}

      if (formState.type !== day.type) update.type = formState.type

      if (formState.description !== day.description) update.description = formState.description
      if (formState.targetHR !== (day.targetHR ?? "")) update.targetHR = formState.targetHR
      if (formState.targetPace !== (day.targetPace ?? "")) update.targetPace = formState.targetPace

      // Distance handling
      if (isRest) {
        // If original entry had a distance, explicitly clear it
        if (day.distanceKm != null) update.distanceKm = null
      } else {
        const raw = parseFloat(formState.distanceDisplay)
        const newKm = isNaN(raw) ? null : raw / (units === "miles" ? KM_TO_MILES : 1)
        const origKm = day.distanceKm ?? null
        // Only include if changed
        if (newKm !== origKm) {
          update.distanceKm = newKm
        }
      }

      onSaveEdit(day.date, day.type, update)
      setIsEditing(false)
    }

    return (
      <div className="space-y-4 p-6">
        {onClose && (
          <button
            onClick={onClose}
            className="mb-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            ✕ Close
          </button>
        )}

        {/* Type */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-1 block">
            Workout Type
          </label>
          <select
            value={formState.type}
            onChange={(e) => {
              const newType = e.target.value as WorkoutType
              setFormState((prev) => ({
                ...prev,
                type: newType,
                distanceDisplay: newType === "rest" ? "" : prev.distanceDisplay,
              }))
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm cursor-pointer"
          >
            {(Object.keys(WORKOUT_NAMES) as WorkoutType[]).map((t) => (
              <option key={t} value={t}>
                {WORKOUT_NAMES[t]}
              </option>
            ))}
          </select>
        </div>

        {/* Distance — hidden for rest */}
        {!isRest && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-1 block">
              Distance ({distanceUnit(units)})
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={formState.distanceDisplay}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, distanceDisplay: e.target.value }))
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g. 10"
            />
          </div>
        )}

        {/* Description */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-1 block">
            Description
          </label>
          <textarea
            value={formState.description}
            onChange={(e) =>
              setFormState((prev) => ({ ...prev, description: e.target.value }))
            }
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
          />
        </div>

        {/* Target HR Zone */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-1 block">
            Target HR Zone
          </label>
          <input
            type="text"
            value={formState.targetHR}
            onChange={(e) =>
              setFormState((prev) => ({ ...prev, targetHR: e.target.value }))
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="e.g. Zone 2 (130–145 bpm)"
          />
        </div>

        {/* Target Pace */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-1 block">
            Target Pace
          </label>
          <input
            type="text"
            value={formState.targetPace}
            onChange={(e) =>
              setFormState((prev) => ({ ...prev, targetPace: e.target.value }))
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="e.g. 5:30–6:00/km"
          />
        </div>

        {/* Save / Cancel */}
        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
          >
            Save
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }
```

This entire block goes **before** the existing `return (` for view mode.

- [ ] **Step 5: Add `distanceUnit` to the imports from `workout-utils`**

Check the existing import at the top — `distanceUnit` is already imported. If for some reason it's not, add it. The import line should read:

```tsx
import {
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
} from "./workout-utils"
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 7: Verify lint passes**

```bash
pnpm lint
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/plan/plan-day-detail.tsx
git commit -m "feat: add edit mode to PlanDayDetail"
```

---

## Chunk 3: Lift Selection State + Wire PlanViewPage

### Task 5: Lift `selectedKey` to controlled props in `PlanCalendar` and `PlanFeed`

**Files:**
- Modify: `apps/web/app/plan/plan-calendar.tsx`
- Modify: `apps/web/app/plan/plan-feed.tsx`

**Context:** Both components currently own `selectedKey` as internal `useState`. The spec requires `PlanViewPage` to own this state so `handleSaveEdit` can update the selection key after a type change. We convert both to controlled components.

For `PlanCalendar`: remove `useState` for `selectedKey`; accept `selectedKey` and `onSelectedKeyChange` as props; replace all `setSelectedKey(...)` calls with `onSelectedKeyChange(...)`. Add `onSaveEdit` prop and forward to `PlanDayDetail`.

For `PlanFeed`: same, plus the backdrop `onClick` and `onClose` must use `onSelectedKeyChange(null)`.

**Important:** Do NOT remove the `useState` import itself — verify first if it's used elsewhere in each file. If `selectedKey` was the only `useState` call, remove the import. Looking at the current code: in both files `useState` is only used for `selectedKey`, so remove the import (or leave it; TypeScript/lint will flag an unused import).

- [ ] **Step 1: Update `PlanCalendar` props interface**

In `apps/web/app/plan/plan-calendar.tsx`, find the `PlanCalendarProps` interface:

```typescript
interface PlanCalendarProps {
  days: WorkoutDay[]
  units: "km" | "miles"
  totalWeeks: number
  raceDistance?: "5k" | "10k" | "half" | "full" | "ultra"
  saveProps?: SaveProps
  onToggleComplete?: (date: string, type: WorkoutType, completed: boolean) => void
}
```

Replace with:

```typescript
interface PlanCalendarProps {
  days: WorkoutDay[]
  units: "km" | "miles"
  totalWeeks: number
  raceDistance?: "5k" | "10k" | "half" | "full" | "ultra"
  saveProps?: SaveProps
  onToggleComplete?: (date: string, type: WorkoutType, completed: boolean) => void
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
  selectedKey: { date: string; type: WorkoutType } | null
  onSelectedKeyChange: (key: { date: string; type: WorkoutType } | null) => void
}
```

- [ ] **Step 2: Update `PlanCalendar` function signature and remove `useState`**

Find:
```typescript
export function PlanCalendar({ days, units, totalWeeks, raceDistance, saveProps, onToggleComplete }: PlanCalendarProps) {
  const [selectedKey, setSelectedKey] = useState<{ date: string; type: WorkoutType } | null>(null)
  // Derive the live WorkoutDay from the days prop so the detail panel always reflects current state
  const selectedDay = selectedKey
    ? (days.find((d) => d.date === selectedKey.date && d.type === selectedKey.type) ?? null)
    : null
```

Replace with:

```typescript
export function PlanCalendar({ days, units, totalWeeks, raceDistance, saveProps, onToggleComplete, onSaveEdit, selectedKey, onSelectedKeyChange }: PlanCalendarProps) {
  // Derive the live WorkoutDay from the days prop so the detail panel always reflects current state
  const selectedDay = selectedKey
    ? (days.find((d) => d.date === selectedKey.date && d.type === selectedKey.type) ?? null)
    : null
```

- [ ] **Step 3: Replace `setSelectedKey` call in the cell button**

Find in `PlanCalendar`:
```typescript
                    onClick={() => setSelectedKey(isSelected ? null : { date: primary.date, type: primary.type })}
```

Replace with:
```typescript
                    onClick={() => onSelectedKeyChange(isSelected ? null : { date: primary.date, type: primary.type })}
```

- [ ] **Step 4: Forward `onSaveEdit` to `PlanDayDetail` in `PlanCalendar`**

Find in `PlanCalendar`:
```tsx
        <PlanDayDetail day={selectedDay} units={units} onToggleComplete={onToggleComplete} />
```

Replace with:
```tsx
        <PlanDayDetail day={selectedDay} units={units} onToggleComplete={onToggleComplete} onSaveEdit={onSaveEdit} />
```

- [ ] **Step 5: Remove unused `useState` import from `PlanCalendar`**

Find at top of `plan-calendar.tsx`:
```typescript
import { useState } from "react"
```

Remove that line (the component no longer uses `useState`).

- [ ] **Step 6: Update `PlanFeed` props interface**

In `apps/web/app/plan/plan-feed.tsx`, find `PlanFeedProps`:

```typescript
interface PlanFeedProps {
  days: WorkoutDay[]
  units: "km" | "miles"
  totalWeeks: number
  raceDistance?: "5k" | "10k" | "half" | "full" | "ultra"
  saveProps?: SaveProps
  onToggleComplete?: (date: string, type: WorkoutType, completed: boolean) => void
}
```

Replace with:

```typescript
interface PlanFeedProps {
  days: WorkoutDay[]
  units: "km" | "miles"
  totalWeeks: number
  raceDistance?: "5k" | "10k" | "half" | "full" | "ultra"
  saveProps?: SaveProps
  onToggleComplete?: (date: string, type: WorkoutType, completed: boolean) => void
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
  selectedKey: { date: string; type: WorkoutType } | null
  onSelectedKeyChange: (key: { date: string; type: WorkoutType } | null) => void
}
```

- [ ] **Step 7: Update `PlanFeed` function signature and remove `useState`**

Find:
```typescript
export function PlanFeed({ days, units, totalWeeks, raceDistance, saveProps, onToggleComplete }: PlanFeedProps) {
  const [selectedKey, setSelectedKey] = useState<{ date: string; type: WorkoutType } | null>(null)
  // Derive the live WorkoutDay from days so the detail sheet always reflects current state
  const selectedDay = selectedKey
    ? (days.find((d) => d.date === selectedKey.date && d.type === selectedKey.type) ?? null)
    : null
```

Replace with:

```typescript
export function PlanFeed({ days, units, totalWeeks, raceDistance, saveProps, onToggleComplete, onSaveEdit, selectedKey, onSelectedKeyChange }: PlanFeedProps) {
  // Derive the live WorkoutDay from days so the detail sheet always reflects current state
  const selectedDay = selectedKey
    ? (days.find((d) => d.date === selectedKey.date && d.type === selectedKey.type) ?? null)
    : null
```

- [ ] **Step 8: Replace `setSelectedKey` calls in `PlanFeed`**

There are three call sites:

1. Card button click handler:
```typescript
                      onClick={() => setSelectedKey(isSelected ? null : { date: day.date, type: day.type })}
```
Replace with:
```typescript
                      onClick={() => onSelectedKeyChange(isSelected ? null : { date: day.date, type: day.type })}
```

2. Backdrop `onClick`:
```tsx
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSelectedKey(null)}>
```
Replace with:
```tsx
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => onSelectedKeyChange(null)}>
```

3. `onClose` prop on `PlanDayDetail`:
```tsx
            <PlanDayDetail day={selectedDay} units={units} onClose={() => setSelectedKey(null)} onToggleComplete={onToggleComplete} />
```
Replace with:
```tsx
            <PlanDayDetail day={selectedDay} units={units} onClose={() => onSelectedKeyChange(null)} onToggleComplete={onToggleComplete} onSaveEdit={onSaveEdit} />
```

- [ ] **Step 9: Remove unused `useState` import from `PlanFeed`**

Find at top of `plan-feed.tsx`:
```typescript
import { useState } from "react"
```

Remove that line.

- [ ] **Step 10: Verify TypeScript compiles**

```bash
pnpm typecheck
```
Expected: TypeScript will report errors on two fronts — (1) `PlanDayDetail` does not yet accept `onSaveEdit` (that prop is added in Task 4 of this plan — ensure that task has been applied first), and (2) `PlanViewPage` does not yet pass `selectedKey` and `onSelectedKeyChange` to `PlanCalendar` and `PlanFeed`. Both are expected. Proceed to Task 6.

- [ ] **Step 11: Commit**

```bash
git add apps/web/app/plan/plan-calendar.tsx apps/web/app/plan/plan-feed.tsx
git commit -m "feat: lift selectedKey to controlled props in PlanCalendar and PlanFeed"
```

---

### Task 6: Wire `handleSaveEdit` and controlled selection in `PlanViewPage`

**Files:**
- Modify: `apps/web/app/plan/[id]/page.tsx`

**Context:** `PlanViewPage` already holds `days` state and `handleToggleComplete`. We need to:
1. Add `selectedKey` / `setSelectedKey` state
2. Implement `handleSaveEdit` with optimistic update + PATCH + revert
3. Pass `selectedKey`, `onSelectedKeyChange`, and `onSaveEdit` to both `PlanCalendar` and `PlanFeed`

The `handleSaveEdit` function must:
- Snapshot previous `days` and `selectedKey` for revert
- Optimistically update `days` (merging the `update` object, handling `distanceKm: null` as a deletion)
- Update `selectedKey` if `update.type` differs from `originalType`
- Fire a `PATCH` fetch (non-async — fire and forget, return `void`)
- On fetch error: revert both `days` and `selectedKey`

- [ ] **Step 1: Add `selectedKey` state and the `WorkoutType` type import check**

In `apps/web/app/plan/[id]/page.tsx`, `WorkoutType` is already imported from `@workspace/ai`. Now add `selectedKey` state after the existing `const [days, setDays] = useState<WorkoutDay[]>([])` line:

```typescript
  const [selectedKey, setSelectedKey] = useState<{ date: string; type: WorkoutType } | null>(null)
```

- [ ] **Step 2: Implement `handleSaveEdit`**

Add this function after `handleToggleComplete` (before the `return` statement):

```typescript
  function handleSaveEdit(
    date: string,
    originalType: WorkoutType,
    update: {
      type?: WorkoutType
      distanceKm?: number | null
      description?: string
      targetHR?: string
      targetPace?: string
    }
  ) {
    if (typeof plan !== "object" || plan === null) return
    const prevDays = days
    const prevSelectedKey = selectedKey

    const updatedDays = days.map((d) => {
      if (d.date !== date || d.type !== originalType) return d
      const next = { ...d }
      if (update.type !== undefined) next.type = update.type
      if (update.description !== undefined) next.description = update.description
      if (update.targetHR !== undefined) next.targetHR = update.targetHR
      if (update.targetPace !== undefined) next.targetPace = update.targetPace
      if ("distanceKm" in update) {
        if (update.distanceKm === null) {
          delete next.distanceKm
        } else if (update.distanceKm !== undefined) {
          next.distanceKm = update.distanceKm
        }
      }
      return next
    })
    setDays(updatedDays)

    if (update.type !== undefined && update.type !== originalType) {
      setSelectedKey({ date, type: update.type })
    }

    fetch(`/api/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type: originalType, update }),
    }).catch(() => {
      setDays(prevDays)
      setSelectedKey(prevSelectedKey)
    })
  }
```

- [ ] **Step 3: Pass `selectedKey`, `onSelectedKeyChange`, and `onSaveEdit` to `PlanCalendar`**

Find:
```tsx
        <PlanCalendar
          days={days}
          units={units}
          totalWeeks={plan.totalWeeks}
          raceDistance={raceDistance}
          onToggleComplete={handleToggleComplete}
        />
```

Replace with:
```tsx
        <PlanCalendar
          days={days}
          units={units}
          totalWeeks={plan.totalWeeks}
          raceDistance={raceDistance}
          onToggleComplete={handleToggleComplete}
          onSaveEdit={handleSaveEdit}
          selectedKey={selectedKey}
          onSelectedKeyChange={setSelectedKey}
        />
```

- [ ] **Step 4: Pass the same props to `PlanFeed`**

Find:
```tsx
        <PlanFeed
          days={days}
          units={units}
          totalWeeks={plan.totalWeeks}
          raceDistance={raceDistance}
          onToggleComplete={handleToggleComplete}
        />
```

Replace with:
```tsx
        <PlanFeed
          days={days}
          units={units}
          totalWeeks={plan.totalWeeks}
          raceDistance={raceDistance}
          onToggleComplete={handleToggleComplete}
          onSaveEdit={handleSaveEdit}
          selectedKey={selectedKey}
          onSelectedKeyChange={setSelectedKey}
        />
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 6: Verify lint passes**

```bash
pnpm lint
```
Expected: no errors.

- [ ] **Step 7: Manual smoke test**

Start the dev server:
```bash
pnpm dev
```

1. Navigate to a saved plan at `/plan/[id]`.
2. **Desktop (calendar view):**
   - Click a workout day — detail panel appears on the right.
   - Click "Edit" — form renders with correct pre-filled values.
   - Change the description, click Save — detail panel returns to view mode with the new description.
   - Click "Edit" again — form shows the saved description (not the old one).
   - Change type to "rest" — distance field disappears.
   - Change back to a non-rest type — distance field reappears empty.
   - Click Cancel — view mode restored with no changes.
3. **Mobile (feed view):**
   - Tap a workout card — bottom sheet appears.
   - Tap Edit — form renders.
   - Save — bottom sheet now shows view mode with updated values.
   - Tap backdrop — bottom sheet closes.
4. **Verify completion toggle still works** — mark a workout complete from the detail panel.
5. **Verify targetHR/targetPace display** — after editing to add a targetHR value, view mode shows it instead of `—`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/plan/[id]/page.tsx
git commit -m "feat: wire handleSaveEdit and controlled selection in PlanViewPage"
```
