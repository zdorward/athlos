# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the dashboard to drive a daily habit loop — open app, see today's workout, mark it done, log effort, feel progress toward race day.

**Architecture:** The dashboard replaces its forward-scan "next workout" logic with date-exact "today's workouts" logic. A new RaceBanner component anchors the screen emotionally. A new TodayWorkoutCard component handles the completion + inline effort picker flow. The WeekList and old WorkoutCard components are deleted.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, `@workspace/ai` types, Drizzle ORM (PostgreSQL)

**Spec:** `docs/superpowers/specs/2026-03-14-dashboard-redesign.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `packages/ai/src/types.ts` | Modify | Add `effort` field to `WorkoutDay` |
| `apps/web/app/api/plans/[id]/route.ts` | Modify | Add effort support to PATCH handler |
| `apps/web/app/dashboard/race-banner.tsx` | Create | Race countdown banner with days away, progress bar, projected time placeholder |
| `apps/web/app/dashboard/today-workout-card.tsx` | Create | Today's workout card with inline effort picker after completion |
| `apps/web/app/dashboard/page.tsx` | Modify | Rewrite using new components and today-based workout logic |
| `apps/web/app/dashboard/week-list.tsx` | Delete | Replaced by tomorrow preview in page.tsx |
| `apps/web/app/dashboard/workout-card.tsx` | Delete | Replaced by TodayWorkoutCard |

---

## Chunk 1: Data Layer

### Task 1: Add `effort` to WorkoutDay type

**Files:**
- Modify: `packages/ai/src/types.ts`

- [ ] **Step 1: Add the field**

Open `packages/ai/src/types.ts`. Add `effort` to the `WorkoutDay` interface after `targetPace`:

```ts
export interface WorkoutDay {
  date: string
  type: WorkoutType
  distanceKm?: number
  description: string
  completed?: boolean
  targetHR?: string
  targetPace?: string
  effort?: "hard" | "good" | "easy"   // ← add this line
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm typecheck
```

Expected: no errors related to this change.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/types.ts
git commit -m "feat: add effort field to WorkoutDay type"
```

---

### Task 2: Update PATCH endpoint to support effort

**Files:**
- Modify: `apps/web/app/api/plans/[id]/route.ts`

The current PATCH has two branches: `isFieldUpdate` (for editing workout fields) and `isCompletionToggle` (for marking done). We need a third path: `isCompletionOrEffort` — which replaces `isCompletionToggle` and handles `completed`, `effort`, or both together.

- [ ] **Step 1: Update the body type and branching logic**

Replace the current PATCH body type and branching section. Find this block (lines ~56–83 in the current file):

```ts
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

Replace with:

```ts
  const body = (await req.json()) as {
    date?: string
    type?: WorkoutType
    completed?: boolean
    effort?: "hard" | "good" | "easy"
    update?: FieldUpdate
  }

  const isFieldUpdate = body.update !== undefined
  const isCompletionOrEffort = !isFieldUpdate && (body.completed !== undefined || body.effort !== undefined)

  if (!isFieldUpdate && !isCompletionOrEffort) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }

  if ((isCompletionOrEffort || isFieldUpdate) && (body.date === undefined || body.type === undefined)) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }
```

- [ ] **Step 2: Update the mutation logic**

Find exactly this line inside the `try` block:

```ts
      entry.completed = body.completed
```

Replace it with:

```ts
      if (body.completed !== undefined) entry.completed = body.completed
      if (body.effort !== undefined) entry.effort = body.effort
```

- [ ] **Step 3: Type-check**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/plans/[id]/route.ts
git commit -m "feat: support effort field in plan PATCH endpoint"
```

---

## Chunk 2: RaceBanner Component

### Task 3: Build RaceBanner

**Files:**
- Create: `apps/web/app/dashboard/race-banner.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/app/dashboard/race-banner.tsx
import { differenceInCalendarDays, parseISO, format } from "date-fns"
import type { PlanGenerationInput, WorkoutDay } from "@workspace/ai"
import { getPhaseLabel, getTaperWeeks } from "@/app/plan/workout-utils"

interface RaceBannerProps {
  input: PlanGenerationInput
  days: WorkoutDay[]
  totalWeeks: number
}

function getPlanWeekNum(days: WorkoutDay[], todayISO: string): number {
  if (days.length === 0) return 1
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const firstDate = sorted[0]!.date
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const elapsed = new Date(todayISO).getTime() - new Date(firstDate).getTime()
  return Math.max(1, Math.floor(elapsed / msPerWeek) + 1)
}

export function RaceBanner({ input, days, totalWeeks }: RaceBannerProps) {
  const todayISO = new Date().toLocaleDateString("en-CA")
  const raceDate = parseISO(input.race.date)
  const daysAway = differenceInCalendarDays(raceDate, parseISO(todayISO))

  if (daysAway < 0) return null  // race has passed — hide banner

  const weekNum = getPlanWeekNum(days, todayISO)
  const taperWeeks = getTaperWeeks(input.race.distance)
  const phase = totalWeeks > 0 ? getPhaseLabel(weekNum, totalWeeks, taperWeeks) : ""
  const progressPct = totalWeeks > 0 ? Math.min(100, Math.round((weekNum / totalWeeks) * 100)) : 0
  const raceDateLabel = format(raceDate, "MMM d, yyyy")

  return (
    <div
      className="rounded-xl p-4 text-white"
      style={{ background: "linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)" }}
    >
      {/* Race name + date */}
      <p className="text-[11px] font-bold uppercase tracking-widest opacity-75 mb-1">
        {input.race.name} · {raceDateLabel}
      </p>

      {/* Days away + projected time */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <span className="text-3xl font-extrabold leading-none">{daysAway}</span>
          <span className="text-sm opacity-80 ml-1.5">days away</span>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest opacity-60 mb-0.5">Proj. finish</p>
          <p className="text-sm font-bold opacity-40">Coming soon</p>
        </div>
      </div>

      {/* Progress bar */}
      {totalWeeks > 0 && (
        <>
          <div className="h-1 rounded-full bg-white/20 mb-1.5">
            <div
              className="h-1 rounded-full bg-white transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[10px] opacity-65">
            Week {weekNum} of {totalWeeks}{phase ? ` · ${phase}` : ""}
          </p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dashboard/race-banner.tsx
git commit -m "feat: add RaceBanner component"
```

---

## Chunk 3: TodayWorkoutCard Component

### Task 4: Build TodayWorkoutCard with inline effort picker

**Files:**
- Create: `apps/web/app/dashboard/today-workout-card.tsx`

The card has two visual states:
1. **Incomplete** — shows workout details + "Mark Complete" button
2. **Complete** — green card + effort picker (Hard / Good / Easy). Effort picker disappears once an effort is selected or if already logged on a previous visit.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/app/dashboard/today-workout-card.tsx
"use client"

import { Check } from "lucide-react"
import type { WorkoutDay } from "@workspace/ai"
import {
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
} from "@/app/plan/workout-utils"

interface TodayWorkoutCardProps {
  entry: WorkoutDay
  units: "km" | "miles"
  onComplete: () => void
  onLogEffort: (effort: "hard" | "good" | "easy") => void
  variant?: "today" | "preview"
}

const EFFORT_OPTIONS: { value: "hard" | "good" | "easy"; emoji: string; label: string }[] = [
  { value: "hard", emoji: "😓", label: "Hard" },
  { value: "good", emoji: "😊", label: "Good" },
  { value: "easy", emoji: "⚡", label: "Easy" },
]

export function TodayWorkoutCard({ entry, units, onComplete, onLogEffort, variant = "today" }: TodayWorkoutCardProps) {
  const isPreview = variant === "preview"
  const isComplete = entry.completed === true
  const hasEffort = entry.effort !== undefined
  const showEffortPicker = isComplete && !hasEffort && !isPreview

  const color = getWorkoutColor(entry.type)
  const textClass = WORKOUT_TEXT_CLASS[entry.type]
  const unit = distanceUnit(units)

  if (isComplete) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 border-l-[3px] border-l-green-500 p-4 space-y-3">
        {/* Completed header */}
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 flex-shrink-0">
            <Check className="h-3 w-3 text-white" />
          </span>
          <div>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
              {WORKOUT_NAMES[entry.type]}
              {entry.distanceKm != null && (
                <span className="font-normal text-green-600/70 dark:text-green-500/70 ml-1.5">
                  · {formatDistance(entry.distanceKm, units)} {unit}
                </span>
              )}
            </p>
            {entry.effort && (
              <p className="text-xs text-green-600/60 dark:text-green-500/60 mt-0.5">
                {EFFORT_OPTIONS.find((o) => o.value === entry.effort)?.emoji}{" "}
                {EFFORT_OPTIONS.find((o) => o.value === entry.effort)?.label}
              </p>
            )}
          </div>
        </div>

        {/* Inline effort picker — only shown if not yet logged */}
        {showEffortPicker && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400">
              How did it feel?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {EFFORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onLogEffort(opt.value)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-green-500/20 bg-white/50 dark:bg-white/5 px-2 py-2 text-center hover:bg-green-500/10 transition-colors cursor-pointer"
                >
                  <span className="text-xl leading-none">{opt.emoji}</span>
                  <span className="text-[11px] font-semibold text-green-700 dark:text-green-400">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Incomplete state
  const borderStyle = color
    ? { borderLeftColor: color }
    : entry.type === "long" || entry.type === "race"
    ? { borderLeftColor: "var(--primary)" }
    : { borderLeftColor: "var(--muted-foreground)" }

  return (
    <div
      className={[
        "rounded-xl border border-border border-l-[3px] bg-card p-4",
        isPreview ? "opacity-50" : "",
      ].join(" ")}
      style={borderStyle}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${textClass}`}
            style={color ? { color } : undefined}
          >
            {WORKOUT_NAMES[entry.type]}
          </p>
          {entry.distanceKm != null && (
            <p className="text-2xl font-extrabold tabular-nums leading-tight mt-0.5">
              {formatDistance(entry.distanceKm, units)}{" "}
              <span className="text-sm font-normal text-muted-foreground">{unit}</span>
            </p>
          )}
        </div>
      </div>

      {entry.description && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          {entry.description}
        </p>
      )}

      {!isPreview && (
        <button
          onClick={onComplete}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
        >
          Mark Complete
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dashboard/today-workout-card.tsx
git commit -m "feat: add TodayWorkoutCard with inline effort picker"
```

---

## Chunk 4: Dashboard Page Rewrite

### Task 5: Rewrite dashboard/page.tsx

**Files:**
- Modify: `apps/web/app/dashboard/page.tsx`

Key logic changes from the old page:
- **Today's workouts**: literal date match (`day.date === todayISO`), not forward scan
- **Rest day**: today has no non-rest entries → show rest card + tomorrow preview
- **Tomorrow preview**: first non-rest date after today → shown when all today's workouts are complete, or on rest days
- **Effort logging**: new `handleLogEffort` — optimistic update + PATCH with rollback
- **Deleted imports**: `WeekList`, `WorkoutCard`, `getDayLabel`, `findNextWorkoutDay`

- [ ] **Step 1: Replace page.tsx**

```tsx
// apps/web/app/dashboard/page.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import type { WorkoutDay, PlanGenerationInput } from "@workspace/ai"
import { DashboardHeader } from "./dashboard-header"
import { RaceBanner } from "./race-banner"
import { TodayWorkoutCard } from "./today-workout-card"
import { Button } from "@workspace/ui/components/button"

interface Plan {
  id: string
  name: string
  days: WorkoutDay[]
  input: PlanGenerationInput
  totalWeeks: number
  totalKm: string
  peakWeekKm: string
  createdAt: string
}

function getTodayISO(): string {
  return new Date().toLocaleDateString("en-CA")
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T00:00:00")
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString("en-CA")
}

/** Returns entries on exactly `dateISO`. */
function getEntriesForDate(days: WorkoutDay[], dateISO: string): WorkoutDay[] {
  return days.filter((d) => d.date === dateISO)
}

/** Returns first date after `afterISO` that has at least one non-rest workout. */
function getNextWorkoutDate(days: WorkoutDay[], afterISO: string): string | null {
  const future = days
    .filter((d) => d.date > afterISO && d.type !== "rest")
    .map((d) => d.date)
  if (future.length === 0) return null
  return future.sort()[0]!
}

function getDayLabel(dateISO: string): string {
  const todayISO = getTodayISO()
  const tomorrowISO = addDays(todayISO, 1)
  if (dateISO === todayISO) return "Today"
  if (dateISO === tomorrowISO) return "Tomorrow"
  return format(parseISO(dateISO), "EEEE, MMM d")
}

export default function DashboardPage() {
  const router = useRouter()
  const { data: sessionData, isPending: sessionPending } = authClient.useSession()

  const [plan, setPlan] = useState<Plan | null | "empty" | "error">(null)

  const fetchPlan = useCallback(async () => {
    try {
      const res = await fetch("/api/plans")
      if (res.status === 401) { router.replace("/"); return }
      if (!res.ok) { setPlan("error"); return }
      const data = (await res.json()) as { plans: Plan[] }
      setPlan(data.plans.length > 0 ? data.plans[0]! : "empty")
    } catch {
      setPlan("error")
    }
  }, [router])

  useEffect(() => {
    if (!sessionPending && !sessionData?.session) router.replace("/")
  }, [sessionPending, sessionData?.session, router])

  useEffect(() => {
    if (!sessionPending && sessionData?.session) void fetchPlan()
  }, [sessionPending, sessionData?.session, fetchPlan])

  if (plan === null) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  const user = sessionData!.user

  if (plan === "error") {
    return (
      <main className="min-h-svh">
        <DashboardHeader name={user.name} email={user.email} image={user.image} />
        <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
          <p className="text-muted-foreground">Unable to load your plan. Please try again.</p>
          <Button variant="outline" onClick={() => void fetchPlan()}>Retry</Button>
        </div>
      </main>
    )
  }

  if (plan === "empty") {
    return (
      <main className="min-h-svh">
        <DashboardHeader name={user.name} email={user.email} image={user.image} />
        <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
          <p className="text-muted-foreground">You don't have a saved plan yet.</p>
          <Button asChild><Link href="/">Create a Plan</Link></Button>
        </div>
      </main>
    )
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleComplete(entry: WorkoutDay) {
    const prevDays = plan.days
    const updated = plan.days.map((d) =>
      d.date === entry.date && d.type === entry.type ? { ...d, completed: true } : d
    )
    setPlan((p) => typeof p === "string" ? p : { ...p, days: updated })
    fetch(`/api/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: entry.date, type: entry.type, completed: true }),
    }).then((res) => {
      if (!res.ok) throw new Error()
    }).catch(() => {
      setPlan((p) => typeof p === "string" ? p : { ...p, days: prevDays })
    })
  }

  function handleLogEffort(entry: WorkoutDay, effort: "hard" | "good" | "easy") {
    const prevDays = plan.days
    const updated = plan.days.map((d) =>
      d.date === entry.date && d.type === entry.type ? { ...d, effort } : d
    )
    setPlan((p) => typeof p === "string" ? p : { ...p, days: updated })
    fetch(`/api/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: entry.date, type: entry.type, effort }),
    }).then((res) => {
      if (!res.ok) throw new Error()
    }).catch(() => {
      setPlan((p) => typeof p === "string" ? p : { ...p, days: prevDays })
    })
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const todayISO = getTodayISO()
  const units = plan.input.units
  const raceDateISO = plan.input.race.date

  // Sort days once for stable first/last date lookups
  const sortedDays = [...plan.days].sort((a, b) => a.date.localeCompare(b.date))
  const firstDayISO = sortedDays[0]?.date ?? null
  const lastDayISO = sortedDays[sortedDays.length - 1]?.date ?? null

  // Today's entries
  const todayEntries = getEntriesForDate(plan.days, todayISO)
  const todayWorkouts = todayEntries.filter((e) => e.type !== "rest")
  const isRestDay = todayWorkouts.length === 0
  const allTodayComplete = todayWorkouts.length > 0 && todayWorkouts.every((e) => e.completed === true)
  const isBeforePlanStart = firstDayISO !== null && todayISO < firstDayISO
  const isAfterRace = todayISO > raceDateISO
  // Plan exhausted: race hasn't passed but all workouts are in the past and today has none
  const isPlanExhausted = !isAfterRace && lastDayISO !== null && todayISO > lastDayISO

  // Tomorrow preview — show when rest day or all today complete
  const showTomorrow = isRestDay || allTodayComplete
  const tomorrowDate = showTomorrow ? getNextWorkoutDate(plan.days, todayISO) : null
  const tomorrowWorkouts = tomorrowDate
    ? getEntriesForDate(plan.days, tomorrowDate).filter((e) => e.type !== "rest")
    : []

  return (
    <main className="min-h-svh">
      <DashboardHeader name={user.name} email={user.email} image={user.image} />

      <div className="mx-auto max-w-xl px-4 py-6 space-y-6">

        {/* Race banner — hidden after race date */}
        {!isAfterRace && (
          <RaceBanner
            input={plan.input}
            days={plan.days}
            totalWeeks={plan.totalWeeks}
          />
        )}

        {/* Before plan starts */}
        {isBeforePlanStart ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              Your plan starts on {format(parseISO(firstDayISO!), "EEEE, MMM d")}.
            </p>
          </div>
        ) : isAfterRace || isPlanExhausted ? (
          /* After race or plan exhausted */
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Your plan is complete 🎉</p>
          </div>
        ) : (
          <>
            {/* Today's workouts */}
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {format(parseISO(todayISO), "EEEE")}
              </h2>

              {isRestDay ? (
                <div className="rounded-xl border border-border bg-card p-4 opacity-50">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Rest Day
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Recovery is part of training.</p>
                </div>
              ) : (
                todayWorkouts.map((entry) => (
                  <TodayWorkoutCard
                    key={entry.date + "-" + entry.type}
                    entry={entry}
                    units={units}
                    onComplete={() => handleComplete(entry)}
                    onLogEffort={(effort) => handleLogEffort(entry, effort)}
                  />
                ))
              )}
            </section>

            {/* Tomorrow preview */}
            {showTomorrow && tomorrowDate && tomorrowWorkouts.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {getDayLabel(tomorrowDate)}
                </h2>
                {tomorrowWorkouts.map((entry) => (
                  <TodayWorkoutCard
                    key={entry.date + "-" + entry.type}
                    entry={entry}
                    units={units}
                    onComplete={() => {}}
                    onLogEffort={() => {}}
                    variant="preview"
                  />
                ))}
              </section>
            )}
          </>
        )}

        {/* View full plan */}
        <div className="pt-2 text-center">
          <Link
            href={`/plan/${plan.id}`}
            className="text-sm text-primary hover:underline"
          >
            View full plan →
          </Link>
        </div>

      </div>
    </main>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Verify in browser**

```bash
pnpm dev
```

Open http://localhost:3000/dashboard and check:
- Race banner appears with correct race name, days away, progress bar
- Today's workout(s) show with "Mark Complete" button
- Tapping "Mark Complete" turns the card green and shows the effort picker
- Selecting an effort hides the picker and shows the logged emoji
- "View full plan →" link works

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/dashboard/page.tsx
git commit -m "feat: rewrite dashboard with race banner and today-based workout logic"
```

---

### Task 6: Delete WeekList and old WorkoutCard

**Files:**
- Delete: `apps/web/app/dashboard/week-list.tsx`
- Delete: `apps/web/app/dashboard/workout-card.tsx`

- [ ] **Step 1: Delete the files**

```bash
rm apps/web/app/dashboard/week-list.tsx
rm apps/web/app/dashboard/workout-card.tsx
```

- [ ] **Step 2: Confirm no remaining imports**

```bash
grep -r "WeekList\|WorkoutCard" apps/web/app/dashboard/ --include="*.tsx"
```

Expected: no output (no remaining references).

- [ ] **Step 3: Type-check and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -u apps/web/app/dashboard/
git commit -m "chore: delete WeekList and WorkoutCard components replaced by redesign"
```
