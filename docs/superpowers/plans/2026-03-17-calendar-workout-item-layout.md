# Calendar & Feed Workout Item Layout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combine same-date run+strength entries into a single card in the mobile feed, and render distance+run name inline on one line in the desktop calendar cell.

**Architecture:** Add `groupDaysByDate` and export `RUN_TYPES` from `workout-utils.ts`. `PlanFeed` uses `groupDaysByDate` to render one card per date group. `PlanCalendar` imports `RUN_TYPES` (replacing inline declaration) and updates its per-entry rendering to the inline format. Rename `WORKOUT_NAMES["strength"]` from `"Strength"` to `"Strength Training"` globally.

**Tech Stack:** React 19, Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Vitest

---

## File Map

| File | Change |
|------|--------|
| `apps/web/app/plan/workout-utils.ts` | Add `groupDaysByDate`, export `RUN_TYPES`, rename `WORKOUT_NAMES["strength"]` |
| `apps/web/app/plan/workout-utils.test.ts` | Add tests for `groupDaysByDate` and the renamed `WORKOUT_NAMES["strength"]` |
| `apps/web/app/plan/plan-feed.tsx` | Use `groupDaysByDate`; render combined card with hairline divider |
| `apps/web/app/plan/plan-calendar.tsx` | Import `RUN_TYPES`; render inline `5 km · Easy Run` format |

---

## Task 1: Add `groupDaysByDate` and export `RUN_TYPES` in `workout-utils.ts`

**Files:**
- Modify: `apps/web/app/plan/workout-utils.ts`
- Test: `apps/web/app/plan/workout-utils.test.ts`

- [ ] **Step 1: Write failing tests for `groupDaysByDate`**

Add to `apps/web/app/plan/workout-utils.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { getWorkoutNote, groupDaysByDate } from "./workout-utils"
import type { WorkoutDay } from "@workspace/plan-engine"

// ... existing tests ...

describe("groupDaysByDate", () => {
  it("groups entries sharing the same date into one array", () => {
    const days: WorkoutDay[] = [
      { date: "2026-06-02", type: "easy", distanceKm: 5 },
      { date: "2026-06-02", type: "strength", distanceKm: null },
      { date: "2026-06-03", type: "rest", distanceKm: null },
    ]
    const result = groupDaysByDate(days)
    expect(result.size).toBe(2)
    expect(result.get("2026-06-02")).toHaveLength(2)
    expect(result.get("2026-06-03")).toHaveLength(1)
  })

  it("preserves insertion order", () => {
    const days: WorkoutDay[] = [
      { date: "2026-06-05", type: "long", distanceKm: 20 },
      { date: "2026-06-03", type: "easy", distanceKm: 8 },
    ]
    const keys = Array.from(groupDaysByDate(days).keys())
    expect(keys).toEqual(["2026-06-05", "2026-06-03"])
  })

  it("handles an empty array", () => {
    expect(groupDaysByDate([]).size).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && pnpm test -- --reporter=verbose workout-utils
```

Expected: FAIL — `groupDaysByDate` is not exported

- [ ] **Step 3: Add `groupDaysByDate` and export `RUN_TYPES` to `workout-utils.ts`**

Add after `groupDaysByWeek` (around line 69):

```ts
export const RUN_TYPES = new Set<WorkoutType>([
  "easy", "long", "progression", "medium-long", "mp", "tempo", "intervals", "race", "shakeout",
])

export function groupDaysByDate(days: WorkoutDay[]): Map<string, WorkoutDay[]> {
  const map = new Map<string, WorkoutDay[]>()
  for (const day of days) {
    const existing = map.get(day.date) ?? []
    existing.push(day)
    map.set(day.date, existing)
  }
  return map
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm test -- --reporter=verbose workout-utils
```

Expected: all `groupDaysByDate` tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/plan/workout-utils.ts apps/web/app/plan/workout-utils.test.ts
git commit -m "feat: add groupDaysByDate and export RUN_TYPES from workout-utils"
```

---

## Task 2: Rename `WORKOUT_NAMES["strength"]` to `"Strength Training"`

**Files:**
- Modify: `apps/web/app/plan/workout-utils.ts`
- Test: `apps/web/app/plan/workout-utils.test.ts`

- [ ] **Step 1: Write a failing test for the renamed label**

Add to `apps/web/app/plan/workout-utils.test.ts`:

```ts
describe("WORKOUT_NAMES", () => {
  it('strength displays as "Strength Training"', () => {
    expect(WORKOUT_NAMES["strength"]).toBe("Strength Training")
  })
})
```

Also update the import at the top of the test file:

```ts
import { getWorkoutNote, groupDaysByDate, WORKOUT_NAMES } from "./workout-utils"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && pnpm test -- --reporter=verbose workout-utils
```

Expected: FAIL — `"Strength" !== "Strength Training"`

- [ ] **Step 3: Apply the rename in `workout-utils.ts`**

In `WORKOUT_NAMES`, change line 11:

```ts
// before
strength: "Strength",

// after
strength: "Strength Training",
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
cd apps/web && pnpm test -- --reporter=verbose workout-utils
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/plan/workout-utils.ts apps/web/app/plan/workout-utils.test.ts
git commit -m "feat: rename strength display name to Strength Training"
```

---

## Task 3: Update `PlanFeed` to render combined run+strength cards

**Files:**
- Modify: `apps/web/app/plan/plan-feed.tsx`

- [ ] **Step 1: Update imports at the top of `plan-feed.tsx`**

Add `groupDaysByDate` and `RUN_TYPES` to the import from `./workout-utils`:

```ts
import {
  groupDaysByWeek,
  getPhaseLabel,
  getTaperWeeks,
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
  groupDaysByDate,
  RUN_TYPES,
} from "./workout-utils"
```

- [ ] **Step 2: Replace the flat `weekDays.map` with a grouped render**

Find the `{/* Day cards */}` block (lines 101–177). Replace entirely:

```tsx
{/* Day cards */}
<div className="space-y-1.5">
  {Array.from(groupDaysByDate(weekDays).values()).map((entries) => {
    const primary = entries.find((e) => RUN_TYPES.has(e.type)) ?? entries[0]!
    const secondaryEntries = entries.filter((e) => e !== primary && e.type !== "rest")
    const isRest = entries.every((e) => e.type === "rest")
    const isRace = entries.some((e) => e.type === "race")
    const isSelected =
      selectedKey?.date === primary.date && selectedKey?.type === primary.type
    const isComplete =
      !isRest && entries.filter((e) => e.type !== "rest").every((e) => e.completed === true)
    const color = getWorkoutColor(primary.type)
    const textClass = WORKOUT_TEXT_CLASS[primary.type]

    const borderStyle = color
      ? { borderLeftColor: color }
      : primary.type === "long" || primary.type === "race"
      ? { borderLeftColor: "var(--primary)" }
      : primary.type === "rest"
      ? { borderLeftColor: "var(--subtle-foreground)" }
      : { borderLeftColor: "var(--muted-foreground)" }

    const effectiveBorderStyle = isComplete
      ? { borderLeftColor: "#22c55e" }
      : borderStyle

    return (
      <button
        key={`${primary.date}-${primary.type}`}
        onClick={() =>
          onSelectedKeyChange(isSelected ? null : { date: primary.date, type: primary.type })
        }
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
      >
        <div className="flex items-center justify-between gap-3">
          {/* Date */}
          <div className="flex flex-col items-center w-10 shrink-0">
            <p className="text-lg font-bold tabular-nums leading-none">
              {format(parseISO(primary.date), "d")}
            </p>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-subtle-foreground">
              {format(parseISO(primary.date), "EEE")}
            </p>
          </div>

          {/* Workout info */}
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-semibold flex items-center gap-1.5 ${textClass}`}
              style={color ? { color } : undefined}
            >
              {isRace && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
              {isComplete && <Check className="h-4 w-4 text-green-600" />}
              {WORKOUT_NAMES[primary.type]}
            </p>
            {secondaryEntries.length > 0 && (
              <div className="mt-1.5 pt-1.5 border-t border-border/[0.06]">
                {secondaryEntries.map((entry) => {
                  const secColor = getWorkoutColor(entry.type)
                  const secTextClass = WORKOUT_TEXT_CLASS[entry.type]
                  return (
                    <p
                      key={entry.type}
                      className={`text-xs font-medium ${secTextClass}`}
                      style={secColor ? { color: secColor } : undefined}
                    >
                      {WORKOUT_NAMES[entry.type]}
                    </p>
                  )
                })}
              </div>
            )}
          </div>

          {/* Distance */}
          {primary.distanceKm != null && (
            <div className="text-right shrink-0">
              <p
                className={`text-lg font-bold tabular-nums ${textClass}`}
                style={color ? { color } : undefined}
              >
                {formatDistance(primary.distanceKm, units)}
              </p>
              <p className="text-[10px] text-muted-foreground">{unit}</p>
            </div>
          )}
        </div>
      </button>
    )
  })}
</div>
```

- [ ] **Step 3: Verify the app compiles**

```bash
pnpm typecheck
```

Expected: no type errors

- [ ] **Step 4: Visual check**

Run `pnpm dev` and open the plan view on a mobile viewport. Confirm:
- A day with both Easy Run and Strength Training shows as **one card** with "Easy Run" on top, hairline divider, "Strength Training" below
- Distance appears on the right of the run row
- A run-only day renders identically to before

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/plan/plan-feed.tsx
git commit -m "feat: combine same-date entries into single card in PlanFeed"
```

---

## Task 4: Update `PlanCalendar` to render inline `5 km · Run Type` format

**Files:**
- Modify: `apps/web/app/plan/plan-calendar.tsx`

- [ ] **Step 1: Update imports in `plan-calendar.tsx`**

Add `RUN_TYPES` to the import from `./workout-utils`:

```ts
import {
  groupDaysByWeek,
  getPhaseLabel,
  getTaperWeeks,
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
  RUN_TYPES,
} from "./workout-utils"
```

- [ ] **Step 2: Remove the inline `RUN_TYPES` declaration**

Delete line 264 (inside the `DAY_ORDER.map()` callback):

```ts
// DELETE this line:
const RUN_TYPES = new Set(["easy", "long", "progression", "medium-long", "mp", "tempo", "intervals", "race", "shakeout"])
```

- [ ] **Step 3: Replace the `entries.map()` rendering block with the inline format**

Find the `entries.map((entry) => { ... })` block (lines 302–328) and replace it:

```tsx
{(() => {
  const primaryEntry = entries.find((e) => RUN_TYPES.has(e.type)) ?? entries[0]!
  const secondaryEntries = entries.filter(
    (e) => e !== primaryEntry && e.type !== "rest"
  )
  const primColor = getWorkoutColor(primaryEntry.type)
  const primTextClass = WORKOUT_TEXT_CLASS[primaryEntry.type]
  return (
    <>
      <p
        className={`text-[10px] font-semibold leading-snug ${primTextClass}`}
        style={primColor ? { color: primColor } : undefined}
      >
        {primaryEntry.distanceKm != null && (
          <>
            <span className="text-sm font-bold tabular-nums">
              {formatDistance(primaryEntry.distanceKm, units)}
            </span>
            <span className="text-[9px] font-normal text-muted-foreground ml-0.5">
              {unit}
            </span>
            {" · "}
          </>
        )}
        {WORKOUT_NAMES[primaryEntry.type]}
      </p>
      {secondaryEntries.map((entry) => {
        const secColor = getWorkoutColor(entry.type)
        const secTextClass = WORKOUT_TEXT_CLASS[entry.type]
        return (
          <p
            key={entry.type}
            className={`text-[10px] mt-0.5 font-medium ${secTextClass}`}
            style={secColor ? { color: secColor } : undefined}
          >
            {WORKOUT_NAMES[entry.type]}
          </p>
        )
      })}
    </>
  )
})()}
```

- [ ] **Step 4: Verify the app compiles**

```bash
pnpm typecheck
```

Expected: no type errors

- [ ] **Step 5: Visual check**

Run `pnpm dev` and open the plan view on desktop. Confirm:
- A calendar cell with Easy Run + Strength Training shows: `5 km · Easy Run` on line 1, `Strength Training` on line 2
- A run-only cell shows: `18 km · Long Run` with no second line
- Rest-day cells are unchanged

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/plan/plan-calendar.tsx
git commit -m "feat: render inline distance · name format in PlanCalendar cells"
```

---

## Task 5: Final checks

- [ ] **Step 1: Run full test suite**

```bash
cd apps/web && pnpm test
```

Expected: all tests pass

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: no errors
