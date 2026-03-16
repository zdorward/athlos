# Workout Completion Tracking Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users mark individual workouts as complete from both the dashboard and the plan view, with green visual treatment and automatic dashboard forward-scan advancement.

**Architecture:** Add `completed?: boolean` to `WorkoutDay`, add a `PATCH /api/plans/[id]` endpoint to persist it, then wire optimistic UI updates into the dashboard hero cards and plan view detail panel. The calendar and feed derive their completion visuals from the `days` prop that flows down from the parent page's local state.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM (Neon Postgres JSONB), Tailwind CSS v4, lucide-react.

---

## File Map

| File | Change |
|---|---|
| `packages/ai/src/types.ts` | Add `completed?: boolean` to `WorkoutDay` |
| `apps/web/app/api/plans/[id]/route.ts` | Add `PATCH` handler |
| `apps/web/app/dashboard/workout-card.tsx` | Add `onComplete` prop + "Done" button |
| `apps/web/app/dashboard/page.tsx` | Wire PATCH + optimistic update + update `findNextWorkoutDay` |
| `apps/web/app/plan/plan-day-detail.tsx` | Add `onToggleComplete` prop + toggle button |
| `apps/web/app/plan/plan-calendar.tsx` | Green cell styling for completed days; pass `onToggleComplete` |
| `apps/web/app/plan/plan-feed.tsx` | Green card styling for completed entries; pass `onToggleComplete` |
| `apps/web/app/plan/[id]/page.tsx` | Hold local `days` state; wire `onToggleComplete`; PATCH + revert |

---

## Chunk 1: Data Model and API

### Task 1: Add `completed` field to `WorkoutDay`

**Files:**
- Modify: `packages/ai/src/types.ts`

**Context:** `WorkoutDay` is the shared type used throughout the app. Adding `completed?: boolean` requires no DB migration because `days` is already a JSONB column. All existing plans lacking the field behave as all-incomplete.

- [ ] **Step 1: Add `completed?: boolean` to the `WorkoutDay` interface**

Open `packages/ai/src/types.ts`. Change:

```typescript
export interface WorkoutDay {
  date: string         // ISO "2026-06-16"
  type: WorkoutType
  distanceKm?: number  // always km; omitted for rest days only
  description: string
}
```

To:

```typescript
export interface WorkoutDay {
  date: string         // ISO "2026-06-16"
  type: WorkoutType
  distanceKm?: number  // always km; omitted for rest days only
  description: string
  completed?: boolean  // undefined and false are both treated as incomplete
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/zackdorward/dev/athloryx
pnpm typecheck
```

Expected: no errors (adding an optional field is non-breaking).

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/types.ts
git commit -m "feat: add completed flag to WorkoutDay type"
```

---

### Task 2: Add PATCH handler to `/api/plans/[id]/route.ts`

**Files:**
- Modify: `apps/web/app/api/plans/[id]/route.ts`

**Context:** The existing file has a `GET` handler with UUID validation and try/catch. The `PATCH` handler follows the same auth + ownership pattern. `days` is JSONB so we write the updated array directly via Drizzle's `.update().set()`. The `update` import is already available in drizzle-orm (used alongside `eq` and `and`).

- [ ] **Step 1: Add the PATCH handler**

Open `apps/web/app/api/plans/[id]/route.ts`. The full file after the change:

```typescript
import { type NextRequest } from "next/server"
import { eq, and } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans } from "@workspace/db"
import type { WorkoutDay, WorkoutType } from "@workspace/ai"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  if (!UUID_RE.test(id)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))
      .limit(1)

    if (!plan) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    return Response.json({ plan })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  if (!UUID_RE.test(id)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const body = (await req.json()) as { date?: string; type?: WorkoutType; completed?: boolean }
  if (body.date === undefined || body.type === undefined || body.completed === undefined) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }
  const { date, type, completed } = body

  try {
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))
      .limit(1)

    if (!plan) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    const days = plan.days as WorkoutDay[]
    const entry = days.find((d) => d.date === date && d.type === type)
    if (!entry) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

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
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/zackdorward/dev/athloryx
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/plans/[id]/route.ts
git commit -m "feat: add PATCH handler for workout completion"
```

---

## Chunk 2: Dashboard Completion

### Task 3: Add "Done" button to `WorkoutCard`

**Files:**
- Modify: `apps/web/app/dashboard/workout-card.tsx`

**Context:** `WorkoutCard` currently has no lucide-react import. Add a `Check` icon import. The "Done" button only renders when `variant === "hero"`, `state.kind === "workout"`, and `onComplete` is provided. It does not appear in preview cards or non-workout states.

- [ ] **Step 1: Update `workout-card.tsx`**

Open `apps/web/app/dashboard/workout-card.tsx`. The full file after the change:

```typescript
import { format, parseISO } from "date-fns"
import { Check } from "lucide-react"
import type { WorkoutDay } from "@workspace/ai"
import {
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
} from "@/app/plan/workout-utils"

export type DayCardState =
  | { kind: "workout"; entry: WorkoutDay }
  | { kind: "rest" }
  | { kind: "before-start"; startDate: string }
  | { kind: "after-end" }

interface WorkoutCardProps {
  state: DayCardState
  dateISO: string
  units: "km" | "miles"
  variant: "hero" | "preview"
  onComplete?: () => void
}

export function WorkoutCard({ state, dateISO, units, variant, onComplete }: WorkoutCardProps) {
  const isHero = variant === "hero"
  const dateLabel = format(parseISO(dateISO), "EEEE, MMM d")

  if (state.kind === "before-start") {
    return (
      <div className={`rounded-xl border border-border bg-card p-4 ${isHero ? "" : "opacity-60"}`}>
        <p className="text-sm text-muted-foreground">
          Your plan starts on {format(parseISO(state.startDate), "EEEE, MMM d")}.
        </p>
      </div>
    )
  }

  if (state.kind === "after-end") {
    return (
      <div className={`rounded-xl border border-border bg-card p-4 ${isHero ? "" : "opacity-60"}`}>
        <p className="text-sm text-muted-foreground">Your plan is complete 🎉</p>
      </div>
    )
  }

  if (state.kind === "rest") {
    return (
      <div className={`rounded-xl border border-border bg-card p-4 ${isHero ? "" : "opacity-60"}`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
          Rest Day
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Recovery is part of training.</p>
      </div>
    )
  }

  // state.kind === "workout"
  const { entry } = state
  const textClass = WORKOUT_TEXT_CLASS[entry.type]
  const inlineColor = getWorkoutColor(entry.type)

  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${isHero ? "" : "opacity-60"}`}>
      <p className="text-xs text-muted-foreground mb-2">{dateLabel}</p>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${textClass}`}
          style={inlineColor ? { color: inlineColor } : undefined}
        >
          {WORKOUT_NAMES[entry.type]}
        </span>
        {entry.distanceKm !== undefined && (
          <span className="text-sm font-semibold tabular-nums">
            {formatDistance(entry.distanceKm, units)}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {distanceUnit(units)}
            </span>
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        {entry.description}
      </p>
      {isHero && onComplete && (
        <button
          onClick={onComplete}
          className="mt-3 flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-500 transition-colors"
        >
          <Check className="h-3 w-3" />
          Done
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/zackdorward/dev/athloryx
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dashboard/workout-card.tsx
git commit -m "feat: add Done button to hero WorkoutCard"
```

---

### Task 4: Wire completion in `DashboardPage`

**Files:**
- Modify: `apps/web/app/dashboard/page.tsx`

**Context:** `DashboardPage` holds `plan` state as `Plan | null | "empty" | "error"`. On "Done": optimistically update `plan.days` in local state, send `PATCH /api/plans/[plan.id]`, revert on error. Also update `findNextWorkoutDay` to skip completed entries so the hero advances after marking done.

The `plan` variable at the point where we render hero cards is known to be a `Plan` object (all null/empty/error cases are handled above). The `setPlan` updater still needs a type guard because TypeScript doesn't narrow the state setter's argument.

- [ ] **Step 1: Update `findNextWorkoutDay` to skip completed entries**

In `apps/web/app/dashboard/page.tsx`, find `findNextWorkoutDay` and change the condition from:

```typescript
if (day.date >= fromDateISO && day.type !== "rest") {
```

To:

```typescript
if (day.date >= fromDateISO && day.type !== "rest" && !day.completed) {
```

- [ ] **Step 2: Add `handleComplete` and wire `onComplete` in the JSX**

In `DashboardPage`, add a `handleComplete` function inside the component (after the plan state is resolved, i.e. after the `if (plan === "empty")` block, before the `// Resolved plan` comment). Then pass `onComplete` to each hero `WorkoutCard`.

The full `handleComplete` function and updated hero JSX:

```typescript
  function handleComplete(entry: WorkoutDay) {
    if (typeof plan !== "object" || plan === null) return
    const prevDays = plan.days
    const updatedDays = plan.days.map((d) =>
      d.date === entry.date && d.type === entry.type ? { ...d, completed: true } : d,
    )
    setPlan((prev) =>
      prev && typeof prev === "object" && prev !== "empty" && prev !== "error"
        ? { ...prev, days: updatedDays }
        : prev,
    )
    fetch(`/api/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: entry.date, type: entry.type, completed: true }),
    }).catch(() => {
      setPlan((prev) =>
        prev && typeof prev === "object" && prev !== "empty" && prev !== "error"
          ? { ...prev, days: prevDays }
          : prev,
      )
    })
  }
```

In the JSX hero section, update each hero `WorkoutCard` to pass `onComplete`:

```tsx
            {heroWorkouts.map((entry) => (
              <WorkoutCard
                key={entry.date + "-" + entry.type}
                state={{ kind: "workout", entry }}
                dateISO={heroDate}
                units={units}
                variant="hero"
                onComplete={() => handleComplete(entry)}
              />
            ))}
```

Note: `handleComplete` must be defined before the `return` statement. Place it just before `// Resolved plan` — the resolved plan block begins at `const todayISO = getTodayISO()`.

- [ ] **Step 3: Typecheck**

```bash
cd /Users/zackdorward/dev/athloryx
pnpm typecheck
```

Expected: no errors. If TypeScript complains about `plan !== "empty"` — the `"empty"` and `"error"` string literals are string values and `typeof prev === "object"` should narrow them out, but if not, add `typeof prev !== "string"` as an additional guard.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/dashboard/page.tsx
git commit -m "feat: wire workout completion on dashboard with optimistic update"
```

---

## Chunk 3: Plan View Completion

### Task 5: Add toggle button to `PlanDayDetail`

**Files:**
- Modify: `apps/web/app/plan/plan-day-detail.tsx`

**Context:** `PlanDayDetail` currently has no `onToggleComplete` prop. Add it as optional. The button renders at the bottom of the detail content (below "Target Pace") for non-rest workout types only. Label toggles between "Mark as complete" and "Mark as incomplete" based on `day.completed`.

- [ ] **Step 1: Update `plan-day-detail.tsx`**

Open `apps/web/app/plan/plan-day-detail.tsx`. The full file after the change:

```typescript
"use client"

import { format, parseISO } from "date-fns"
import { Star, Check } from "lucide-react"
import type { WorkoutDay, WorkoutType } from "@workspace/ai"
import {
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
} from "./workout-utils"

interface PlanDayDetailProps {
  day: WorkoutDay | null
  units: "km" | "miles"
  onClose?: () => void
  onToggleComplete?: (date: string, type: WorkoutType, completed: boolean) => void
}

export function PlanDayDetail({ day, units, onClose, onToggleComplete }: PlanDayDetailProps) {
  if (!day) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-subtle-foreground">Select a workout to see details</p>
      </div>
    )
  }

  const color = getWorkoutColor(day.type)
  const textClass = WORKOUT_TEXT_CLASS[day.type]
  const colorStyle = color ? { color } : undefined

  return (
    <div className="space-y-6 p-6">
      {onClose && (
        <button
          onClick={onClose}
          className="mb-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          ✕ Close
        </button>
      )}

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

      {day.distanceKm != null && (
        <div>
          <span
            className={`text-5xl font-bold tracking-tight font-mono ${textClass}`}
            style={colorStyle}
          >
            {formatDistance(day.distanceKm, units)}
          </span>
          <span className="ml-2 text-lg text-muted-foreground">{distanceUnit(units)}</span>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-2">
          Workout
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">{day.description}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-2">
          Target HR Zone
        </p>
        <p className="text-sm text-subtle-foreground">—</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-2">
          Target Pace
        </p>
        <p className="text-sm text-subtle-foreground">—</p>
      </div>

      {day.type !== "rest" && onToggleComplete && (
        <button
          onClick={() => onToggleComplete(day.date, day.type, !day.completed)}
          className="flex items-center gap-1.5 text-sm font-semibold text-green-600 hover:text-green-500 transition-colors"
        >
          <Check className="h-4 w-4" />
          {day.completed ? "Mark as incomplete" : "Mark as complete"}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/zackdorward/dev/athloryx
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/plan-day-detail.tsx
git commit -m "feat: add completion toggle to PlanDayDetail"
```

---

### Task 6: Add green cell styling and wire `onToggleComplete` in `PlanCalendar`

**Files:**
- Modify: `apps/web/app/plan/plan-calendar.tsx`

**Context:** `PlanCalendar` already computes `primary` (the run-type entry, or first entry if none) via `entries.find((d) => RUN_TYPES.has(d.type)) ?? entries[0]!`. The "fully complete" check is: every non-rest entry in `entries` has `completed === true`.

Visual treatment:
- Non-race, fully complete cell: `bg-green-500/10 border-green-500/30` (replaces `bg-card border-border`)
- Non-race, fully complete + selected: `bg-green-500/10 border-green-500/50`
- Race, fully complete: keep `bg-primary/12 border-primary`, add `Check` icon
- Incomplete cells: unchanged

**Important:** The existing `selectedDay` state stores a full `WorkoutDay` snapshot. If it stored the snapshot before a toggle fires, `PlanDayDetail` would receive the stale `completed` value and show the wrong button label. Fix this by replacing `useState<WorkoutDay | null>` with a key `{ date: string; type: WorkoutType } | null` and deriving the live `day` from the `days` prop each render.

`onToggleComplete` is accepted as a new optional prop on `PlanCalendar` and forwarded to `PlanDayDetail`.

- [ ] **Step 1: Update `plan-calendar.tsx`**

Open `apps/web/app/plan/plan-calendar.tsx`.

**Import change** — add `Check` to the lucide-react import:
```typescript
import { Star, Check } from "lucide-react"
```

**Add `WorkoutType` to the `@workspace/ai` import:**
```typescript
import type { WorkoutDay, WorkoutType } from "@workspace/ai"
```

**Interface change** — add `onToggleComplete` to `PlanCalendarProps`:
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

**Function signature** — destructure `onToggleComplete`:
```typescript
export function PlanCalendar({ days, units, totalWeeks, raceDistance, saveProps, onToggleComplete }: PlanCalendarProps) {
```

**Replace `selectedDay` state with a key** — change the existing `useState` line:

Old:
```typescript
const [selectedDay, setSelectedDay] = useState<WorkoutDay | null>(null)
```

New:
```typescript
const [selectedKey, setSelectedKey] = useState<{ date: string; type: WorkoutType } | null>(null)
// Derive the live WorkoutDay from the days prop so the detail panel always reflects current state
const selectedDay = selectedKey
  ? (days.find((d) => d.date === selectedKey.date && d.type === selectedKey.type) ?? null)
  : null
```

**Update cell click handler** — change `setSelectedDay(isSelected ? null : primary)` to:
```typescript
setSelectedKey(isSelected ? null : { date: primary.date, type: primary.type })
```

**Update `isSelected` computation** — the current code is:
```typescript
const isSelected = selectedDay?.date === primary.date && selectedDay?.type === primary.type
```
This is unchanged — `selectedDay` is now derived above and still has `.date` and `.type`. No change needed here.

**Inside the day cell rendering block**, after the existing `isSelected` computation, add:
```typescript
const isFullyComplete = !isRest && entries.filter((e) => e.type !== "rest").every((e) => e.completed === true)
```

**Cell button `className`** — replace the existing className ternary with one that handles completion:

```tsx
                    className={[
                      "min-h-[72px] rounded-md border p-2 text-left transition-colors cursor-pointer",
                      isRace
                        ? "bg-primary/12 border-primary"
                        : isFullyComplete && isSelected
                        ? "bg-green-500/10 border-green-500/50"
                        : isFullyComplete
                        ? "bg-green-500/10 border-green-500/30"
                        : isSelected
                        ? "bg-muted border-primary/40"
                        : "bg-card border-border hover:border-primary/25",
                      isRest ? "opacity-40" : "",
                    ].join(" ")}
```

**Date number + checkmark** — replace the existing date `<p>` with a wrapper that includes the checkmark:

```tsx
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-subtle-foreground">
                        {format(parseISO(primary.date), "d")}
                      </p>
                      {isFullyComplete && (
                        <Check className="h-3 w-3 text-green-600" />
                      )}
                    </div>
```

(Remove the original `<p className="text-[10px] text-subtle-foreground mb-1">` line.)

**`PlanDayDetail` at the bottom of the component** — add `onToggleComplete` prop:

```tsx
      <div className="w-72 border-l border-border bg-card overflow-y-auto flex-shrink-0">
        <PlanDayDetail day={selectedDay} units={units} onToggleComplete={onToggleComplete} />
      </div>
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/zackdorward/dev/athloryx
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/plan-calendar.tsx
git commit -m "feat: green completion styling in plan calendar + wire toggle"
```

---

### Task 7: Add green card styling and wire `onToggleComplete` in `PlanFeed`

**Files:**
- Modify: `apps/web/app/plan/plan-feed.tsx`

**Context:** Each feed card is its own `WorkoutDay` entry (one row per entry). A card is visually complete when `day.completed === true`. For completed non-rest cards:
- Left border color: green (override the inline `borderStyle` with green)
- Background: `bg-green-500/5` (replace `bg-card`)
- Add `Check` icon next to the workout name

The existing `borderStyle` is applied via inline style. For completed entries, set `borderLeftColor` to the green-500 color value (`#22c55e`) in the same inline style — this overrides the workout-type color consistently.

**Important:** Same stale-snapshot issue as the calendar — `selectedDay` in `useState` must be replaced with a key `{ date, type }` and the live entry derived from `days` each render.

- [ ] **Step 1: Update `plan-feed.tsx`**

Open `apps/web/app/plan/plan-feed.tsx`.

**Import change** — add `Check` to lucide-react:
```typescript
import { Star, Check } from "lucide-react"
```

**Add `WorkoutType` to the `@workspace/ai` import:**
```typescript
import type { WorkoutDay, WorkoutType } from "@workspace/ai"
```

**Interface change** — add `onToggleComplete` to `PlanFeedProps`:
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

**Function signature** — destructure `onToggleComplete`:
```typescript
export function PlanFeed({ days, units, totalWeeks, raceDistance, saveProps, onToggleComplete }: PlanFeedProps) {
```

**Replace `selectedDay` state with a key** — change the existing `useState` line:

Old:
```typescript
const [selectedDay, setSelectedDay] = useState<WorkoutDay | null>(null)
```

New:
```typescript
const [selectedKey, setSelectedKey] = useState<{ date: string; type: WorkoutType } | null>(null)
// Derive the live WorkoutDay from days so the detail sheet always reflects current state
const selectedDay = selectedKey
  ? (days.find((d) => d.date === selectedKey.date && d.type === selectedKey.type) ?? null)
  : null
```

**Update card click handler** — change `setSelectedDay(isSelected ? null : day)` to:
```typescript
setSelectedKey(isSelected ? null : { date: day.date, type: day.type })
```

**Close handlers** — both `onClick={() => setSelectedDay(null)}` references (backdrop and `onClose` prop) become:
```tsx
onClick={() => setSelectedKey(null)}
```

**Inside the day card rendering block**, after the existing `borderStyle` computation, add:
```typescript
                  const isComplete = !isRest && day.completed === true
                  const effectiveBorderStyle = isComplete
                    ? { borderLeftColor: "#22c55e" }
                    : borderStyle
```

**Card button `className`** — replace the existing className ternary to include `bg-green-500/5` for completed:

```tsx
                      className={[
                        "w-full rounded-lg border border-l-4 p-3 text-left transition-colors cursor-pointer",
                        isRace
                          ? "bg-primary/12 border-border"
                          : isComplete
                          ? "bg-green-500/5 border-border"
                          : isSelected
                          ? "bg-muted border-border"
                          : "bg-card border-border hover:bg-muted",
                        isRest ? "opacity-40" : "",
                      ].join(" ")}
                      style={effectiveBorderStyle}
```

**Workout name row** — add `Check` icon for completed entries (next to the name):

```tsx
                          <p
                            className={`text-sm font-semibold flex items-center gap-1.5 ${textClass}`}
                            style={color ? { color } : undefined}
                          >
                            {isRace && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                            {isComplete && <Check className="h-4 w-4 text-green-600" />}
                            {WORKOUT_NAMES[day.type]}
                          </p>
```

**`PlanDayDetail` in the bottom sheet** — add `onToggleComplete` prop:

```tsx
            <PlanDayDetail day={selectedDay} units={units} onClose={() => setSelectedKey(null)} onToggleComplete={onToggleComplete} />
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/zackdorward/dev/athloryx
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/plan-feed.tsx
git commit -m "feat: green completion styling in plan feed + wire toggle"
```

---

### Task 8: Wire `onToggleComplete` in `PlanViewPage`

**Files:**
- Modify: `apps/web/app/plan/[id]/page.tsx`

**Context:** Currently `PlanViewPage` passes `plan.days` directly to `PlanCalendar` and `PlanFeed`. We need to lift `days` into local state so optimistic updates can be applied without re-fetching. The `onToggleComplete` handler updates local state, sends PATCH, and reverts on error. `plan.id` is always available at this point (past the null/"not-found" guards).

- [ ] **Step 1: Update `apps/web/app/plan/[id]/page.tsx`**

Open `apps/web/app/plan/[id]/page.tsx`. The full file after the change:

```typescript
"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ChevronLeft } from "lucide-react"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import type { WorkoutDay, WorkoutType, PlanGenerationInput } from "@workspace/ai"
import { PlanHeader } from "@/app/plan/plan-header"
import { PlanCalendar } from "@/app/plan/plan-calendar"
import { PlanFeed } from "@/app/plan/plan-feed"

interface Plan {
  id: string
  name: string
  days: WorkoutDay[]
  input: PlanGenerationInput
  totalWeeks: number
  totalKm: string
  peakWeekKm: string
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function PlanViewPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { data: sessionData, isPending: sessionPending } = authClient.useSession()

  const [plan, setPlan] = useState<Plan | null | "not-found">(null)
  const [days, setDays] = useState<WorkoutDay[]>([])
  const [fetching, setFetching] = useState(false)

  // Redirect if no session
  useEffect(() => {
    if (!sessionPending && !sessionData?.session) {
      router.replace("/")
    }
  }, [sessionPending, sessionData?.session, router])

  // Fetch plan once session confirmed
  useEffect(() => {
    if (!sessionPending && !sessionData?.session) return
    if (sessionPending) return

    setFetching(true)
    fetch(`/api/plans/${id}`)
      .then(async (res) => {
        if (res.status === 404 || res.status === 401) {
          setPlan("not-found")
          return
        }
        if (!res.ok) {
          setPlan("not-found")
          return
        }
        const data = (await res.json()) as { plan: Plan }
        setPlan(data.plan)
        setDays(data.plan.days)
      })
      .catch(() => setPlan("not-found"))
      .finally(() => setFetching(false))
  }, [id, sessionPending, sessionData?.session])

  // Show spinner only on initial load — don't flash on background session re-validation
  if (plan === null) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (plan === "not-found") {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground">Plan not found.</p>
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </main>
    )
  }

  const units = plan.input.units
  const raceDistance = plan.input.race?.distance

  function handleToggleComplete(date: string, type: WorkoutType, completed: boolean) {
    const prevDays = days
    const updatedDays = days.map((d) =>
      d.date === date && d.type === type ? { ...d, completed } : d,
    )
    setDays(updatedDays)
    fetch(`/api/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type, completed }),
    }).catch(() => {
      setDays(prevDays)
    })
  }

  return (
    <main className="min-h-svh flex flex-col">
      <PlanHeader
        planName={plan.name}
        totalWeeks={plan.totalWeeks}
        totalKm={Number(plan.totalKm)}
        units={units}
        status="complete"
        backHref="/dashboard"
      />

      {/* Desktop: calendar */}
      <div className="hidden md:block flex-1">
        <PlanCalendar
          days={days}
          units={units}
          totalWeeks={plan.totalWeeks}
          raceDistance={raceDistance}
          onToggleComplete={handleToggleComplete}
        />
      </div>

      {/* Mobile: feed */}
      <div className="md:hidden flex-1 overflow-y-auto pt-2">
        <PlanFeed
          days={days}
          units={units}
          totalWeeks={plan.totalWeeks}
          raceDistance={raceDistance}
          onToggleComplete={handleToggleComplete}
        />
      </div>
    </main>
  )
}
```

Note: `plan.id` is used inside `handleToggleComplete` — TypeScript narrows `plan` to `Plan` at that point because we're past the null/"not-found" guards.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/zackdorward/dev/athloryx
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/[id]/page.tsx
git commit -m "feat: wire completion toggle in plan view with local days state"
```

---

## Final Verification

- [ ] **Run full typecheck from root**

```bash
cd /Users/zackdorward/dev/athloryx
pnpm typecheck
```

Expected: zero errors across all packages.

- [ ] **Manual smoke test checklist**
  1. Dashboard: open app, see hero workout card with "Done" button
  2. Click "Done" — hero card advances to next workout (optimistic, no reload)
  3. Plan view (desktop): open a plan, select a non-rest cell, detail panel shows "Mark as complete" button
  4. Click "Mark as complete" — cell gets green tint + checkmark, button label changes to "Mark as incomplete"
  5. Click "Mark as incomplete" — cell returns to normal
  6. Plan view (mobile): feed cards show green styling for completed entries; tap a completed card → bottom sheet shows "Mark as incomplete"
  7. Refresh plan view — green state persists (PATCH was saved to DB)
