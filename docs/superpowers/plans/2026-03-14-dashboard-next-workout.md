# Dashboard Next Workout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed Today/Tomorrow dashboard sections with dynamic Next Workout / Then sections that always show the next actionable workout.

**Architecture:** Single file change to `apps/web/app/dashboard/page.tsx`. Add two pure helper functions (`findNextWorkoutDay`, `getDayLabel`), replace the Today/Tomorrow variable computation block with a hero/then forward-scan, and update the JSX render sections accordingly.

**Tech Stack:** Next.js 16, React 19, TypeScript, date-fns, `@workspace/ai` types.

---

## File Map

**Modified:**
- `apps/web/app/dashboard/page.tsx` — add helpers, replace Today/Tomorrow logic and JSX with hero/then

---

## Task 1: Replace Today/Tomorrow with Next Workout / Then

**Files:**
- Modify: `apps/web/app/dashboard/page.tsx`

### Context

The current file (read it before making changes) has:
- A `getTodayISO` helper and an `addDays` helper — keep both unchanged
- A `byDate` map built from `plan.days`
- Variables `todayEntries`, `tomorrowEntries`, `todayWorkouts`, `tomorrowWorkouts`, `todayOutOfRange`, `tomorrowOutOfRange` — all of these will be replaced
- Two JSX sections labeled "Today" and "Tomorrow" — both will be replaced
- Imports from `date-fns`: currently none in this file — need to add `format` and `parseISO`

### Step 1: Add `date-fns` import

Find the existing imports at the top of `apps/web/app/dashboard/page.tsx`. Add `format` and `parseISO` from `date-fns`:

```typescript
import { format, parseISO } from "date-fns"
```

Place it after the `"next/navigation"` import and before the `"lucide-react"` import, consistent with the existing ordering pattern.

- [ ] Add the import line

### Step 2: Add `findNextWorkoutDay` helper

After the existing `addDays` function (around line 33), add:

```typescript
function findNextWorkoutDay(days: WorkoutDay[], fromDateISO: string): string | null {
  // Build sorted unique dates with at least one non-rest entry
  const seen = new Set<string>()
  for (const day of days) {
    if (day.date >= fromDateISO && day.type !== "rest") {
      seen.add(day.date)
    }
  }
  if (seen.size === 0) return null
  return [...seen].sort()[0]!
}
```

- [ ] Add `findNextWorkoutDay` after `addDays`

### Step 3: Add `getDayLabel` helper

After `findNextWorkoutDay`, add:

```typescript
function getDayLabel(dateISO: string, todayISO: string, tomorrowISO: string): string {
  if (dateISO === todayISO) return "Today"
  if (dateISO === tomorrowISO) return "Tomorrow"
  return format(parseISO(dateISO), "EEEE, MMM d")
}
```

- [ ] Add `getDayLabel` after `findNextWorkoutDay`

### Step 4: Replace the Today/Tomorrow computation block

Find and replace the entire block from the `// Resolved plan` comment (line 116) through the `tomorrowOutOfRange` declaration (line 150) — i.e. replace all of it, including the `todayISO`, `tomorrowISO`, `planStartDate`, `planEndDate`, `units`, `byDate`, and the `todayWorkouts`/`tomorrowWorkouts`/`todayOutOfRange`/`tomorrowOutOfRange` declarations. Replace with:

```typescript
  // Resolved plan
  const todayISO = getTodayISO()
  const tomorrowISO = addDays(todayISO, 1)
  const units = plan.input.units

  // Build date → entries lookup
  const byDate = new Map<string, WorkoutDay[]>()
  for (const day of plan.days) {
    const existing = byDate.get(day.date) ?? []
    existing.push(day)
    byDate.set(day.date, existing)
  }

  // Forward-scan for next workout day
  const heroDate = findNextWorkoutDay(plan.days, todayISO)
  const thenDate = heroDate ? findNextWorkoutDay(plan.days, addDays(heroDate, 1)) : null

  const heroWorkouts = heroDate
    ? (byDate.get(heroDate) ?? []).filter((e) => e.type !== "rest")
    : []
  const thenWorkouts = thenDate
    ? (byDate.get(thenDate) ?? []).filter((e) => e.type !== "rest")
    : []
```

Note: `planStartDate` and `planEndDate` are no longer needed — remove them.

- [ ] Replace the computation block

### Step 5: Replace the Today/Tomorrow JSX sections

Find the `{/* Today */}` and `{/* Tomorrow */}` JSX sections (roughly lines 158–220). Replace both with:

```tsx
        {/* Next Workout */}
        {heroDate === null ? (
          <WorkoutCard
            state={{ kind: "after-end" }}
            dateISO={todayISO}
            units={units}
            variant="hero"
          />
        ) : (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
              {getDayLabel(heroDate, todayISO, tomorrowISO)}
            </h2>
            {heroWorkouts.map((entry) => (
              <WorkoutCard
                key={entry.date + "-" + entry.type}
                state={{ kind: "workout", entry }}
                dateISO={heroDate}
                units={units}
                variant="hero"
              />
            ))}
          </section>
        )}

        {/* Then */}
        {thenDate !== null && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
              {getDayLabel(thenDate, todayISO, tomorrowISO)}
            </h2>
            {thenWorkouts.map((entry) => (
              <WorkoutCard
                key={entry.date + "-" + entry.type}
                state={{ kind: "workout", entry }}
                dateISO={thenDate}
                units={units}
                variant="preview"
              />
            ))}
          </section>
        )}
```

- [ ] Replace both JSX sections

### Step 6: Remove unused imports

The `DayCardState` type import may now be unused (it was used for `todayOutOfRange` / `tomorrowOutOfRange` which are removed). Check the import line:

```typescript
import { WorkoutCard, type DayCardState } from "./workout-card"
```

Remove `type DayCardState` if it no longer appears anywhere else in the file:

```typescript
import { WorkoutCard } from "./workout-card"
```

- [ ] Remove unused `DayCardState` import if applicable

### Step 7: Typecheck

```bash
cd /Users/zackdorward/dev/athloryx
pnpm typecheck
```

Expected: no errors. Common issues to watch for:
- `heroDate` could be `null` — the JSX checks this before use, so TypeScript should be happy
- `thenDate` same
- `format`/`parseISO` types from `date-fns` — straightforward

- [ ] Run typecheck and confirm clean

### Step 8: Commit

```bash
git add apps/web/app/dashboard/page.tsx
git commit -m "feat: replace Today/Tomorrow with Next Workout/Then forward-scan on dashboard"
```

- [ ] Commit
