# Dashboard & Post-Save Navigation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/dashboard` page showing today's workout as a hero card, add a profile avatar with sign-out dropdown, and redirect users to `/dashboard` after saving a plan.

**Architecture:** New API routes (`GET /api/plans`, `GET /api/plans/[id]`) serve plan data. The dashboard is a client component that fetches the user's most recent plan and resolves today/tomorrow against the plan's `days` array. The `/plan/[id]` page renders the existing `PlanCalendar`/`PlanFeed` components with DB data instead of streamed data.

**Tech Stack:** Next.js 16 App Router, Better Auth, Drizzle ORM + Neon Postgres, shadcn/ui, Tailwind CSS v4, TypeScript, `@workspace/ai` types, `@workspace/db` schema.

---

## File Map

**New files:**
- `apps/web/app/api/plans/[id]/route.ts` — GET single plan by ID
- `apps/web/app/dashboard/page.tsx` — Authenticated home page
- `apps/web/app/dashboard/dashboard-header.tsx` — Logo + avatar dropdown
- `apps/web/app/dashboard/workout-card.tsx` — Today/tomorrow day cards
- `apps/web/app/dashboard/week-list.tsx` — "This Week" compact rows
- `apps/web/app/plan/[id]/page.tsx` — Read-only full plan view

**Modified files:**
- `apps/web/app/api/plans/route.ts` — Add GET handler
- `apps/web/app/page.tsx` — Auth redirect to `/dashboard`
- `apps/web/app/plan/page.tsx` — Post-save redirect, 401 handling, remove `isSaved`
- `apps/web/app/plan/save-plan-button.tsx` — Remove `isSaved` prop/state (dead code after redirect)

---

## Chunk 1: API Routes

### Task 1: Add GET handler to `/api/plans/route.ts`

**Files:**
- Modify: `apps/web/app/api/plans/route.ts`

- [ ] **Step 1: Add GET handler**

Open `apps/web/app/api/plans/route.ts`. The current file has no `drizzle-orm` import — add one. Replace the entire import block at the top with:

```typescript
import { type NextRequest } from "next/server"
import { eq, desc } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans } from "@workspace/db"
import type { PlanGenerationInput, WorkoutDay } from "@workspace/ai"
```

Then add this function after the existing `POST` export:

```typescript
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userPlans = await db
    .select()
    .from(plans)
    .where(eq(plans.userId, session.user.id))
    .orderBy(desc(plans.createdAt))

  return Response.json({ plans: userPlans })
}
```

- [ ] **Step 2: Verify it builds**

```bash
cd /Users/zackdorward/dev/athloryx
pnpm typecheck
```

Expected: no new type errors.

- [ ] **Step 3: Manual smoke test**

Start the dev server (`pnpm dev`) and run:

```bash
curl -s http://localhost:3000/api/plans | head -c 200
```

Expected: `{"error":"Unauthorized"}` (401 without a session cookie).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/plans/route.ts
git commit -m "feat: add GET /api/plans endpoint"
```

---

### Task 2: Create `GET /api/plans/[id]`

**Files:**
- Create: `apps/web/app/api/plans/[id]/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { type NextRequest } from "next/server"
import { eq, and } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans } from "@workspace/db"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))
    .limit(1)

  if (!plan) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  return Response.json({ plan })
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

```bash
curl -s http://localhost:3000/api/plans/non-existent-id | head -c 100
```

Expected: `{"error":"Unauthorized"}` (no session cookie).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/plans/[id]/route.ts
git commit -m "feat: add GET /api/plans/[id] endpoint"
```

---

## Chunk 2: Landing Page + Post-Save Flow

### Task 3: Install DropdownMenu component

**Files:**
- Creates component in `packages/ui/src/components/dropdown-menu.tsx`

- [ ] **Step 1: Add DropdownMenu via shadcn**

```bash
cd /Users/zackdorward/dev/athloryx
pnpm dlx shadcn@latest add dropdown-menu -c apps/web
```

Expected: `packages/ui/src/components/dropdown-menu.tsx` created.

- [ ] **Step 2: Confirm the component is importable**

Components in this repo are imported directly as `@workspace/ui/components/<name>` (no barrel file needed — the package resolves them via `package.json` exports). Verify the file exists:

```bash
ls packages/ui/src/components/dropdown-menu.tsx
```

Expected: file listed. No additional export configuration needed.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/dropdown-menu.tsx
git commit -m "chore: add shadcn DropdownMenu component"
```

---

### Task 4: Update landing page with auth redirect

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Replace `apps/web/app/page.tsx` entirely**

```typescript
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { Button } from "@workspace/ui/components/button"

export default function Page() {
  const router = useRouter()
  const { data: sessionData, isPending } = authClient.useSession()
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!isPending && sessionData?.session) {
      router.replace("/dashboard")
    }
  }, [isPending, sessionData?.session, router])

  // Show spinner while loading or while redirecting (session exists)
  if (isPending || sessionData?.session) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (showOnboarding) {
    return (
      <main className="min-h-svh">
        <OnboardingFlow onExit={() => setShowOnboarding(false)} />
      </main>
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-5">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Athloryx</h1>
        <p className="text-muted-foreground">Your adaptive training plan, built around you.</p>
        <Button size="lg" onClick={() => setShowOnboarding(true)}>
          Create a Plan
        </Button>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual test — unauthenticated**

Visit `http://localhost:3000`. Expected: landing page renders normally (no redirect loop).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: redirect authenticated users from landing to /dashboard"
```

---

### Task 5: Update post-save flow in `/plan/page.tsx`

This removes `isSaved` state (dashboard is now the confirmation), handles 401 separately, and redirects on success. Also cleans up `save-plan-button.tsx`.

**Files:**
- Modify: `apps/web/app/plan/page.tsx`
- Modify: `apps/web/app/plan/save-plan-button.tsx`

- [ ] **Step 1: Remove `isSaved` from `SaveProps` and `SavePlanButton`**

Replace the entire contents of `apps/web/app/plan/save-plan-button.tsx`:

```typescript
"use client"

import { Loader2, BookmarkPlus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

export interface SaveProps {
  status: "generating" | "complete" | "error"
  isSaving: boolean
  saveError: boolean
  onSave: () => void
}

interface SavePlanButtonProps extends SaveProps {
  className?: string
}

export function SavePlanButton({
  status,
  isSaving,
  saveError,
  onSave,
  className,
}: SavePlanButtonProps) {
  if (status !== "complete") return null

  if (isSaving) {
    return (
      <Button disabled className={`gap-2 ${className ?? ""}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Saving…
      </Button>
    )
  }

  return (
    <Button onClick={onSave} className={`gap-2 ${className ?? ""}`}>
      <BookmarkPlus className="h-4 w-4" />
      {saveError ? "Save failed — retry" : "Save Plan"}
    </Button>
  )
}
```

- [ ] **Step 2: Update `savePlanToServer` in `apps/web/app/plan/page.tsx`**

Find and replace the `savePlanToServer` function (lines ~263–285). Replacing this function body also covers the auto-save path — the same function is called after OAuth redirect, so the `router.push("/dashboard")` on success applies there too.

```typescript
async function savePlanToServer(
  planInput: PlanGenerationInput,
  days: WorkoutDay[],
  totalWeeks: number,
  totalKm: number,
  peakWeekKm: number,
) {
  setIsSaving(true)
  setSaveError(false)
  try {
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: planInput, days, totalWeeks, totalKm, peakWeekKm }),
    })
    if (res.status === 401) {
      setShowSignInSheet(true)
      return
    }
    if (!res.ok) throw new Error("Save failed")
    router.push("/dashboard")
  } catch {
    setSaveError(true)
  } finally {
    setIsSaving(false)
  }
}
```

Note: Step 2 (replacing the function body) already removes the `setIsSaved(true)` call. Step 3a below removes the matching `useState` declaration. Do Steps 2 and 3 together before running typecheck.

- [ ] **Step 3: Remove `isSaved` state and update dependents in `page.tsx`**

a) Remove this line from state declarations (now that `setIsSaved` is gone from the function above):
```typescript
const [isSaved, setIsSaved] = useState(false)
```

b) Update `handleSave` — remove `isSaved` from the guard:
```typescript
function handleSave() {
  if (isSaving) return
  if (!sessionData?.session) {
    setShowSignInSheet(true)
    return
  }
  const current = planRef.current
  if (!input || !current.days?.length) return
  void savePlanToServer(
    input,
    current.days,
    current.totalWeeks ?? 0,
    current.totalKm ?? 0,
    current.peakWeekKm ?? 0,
  )
}
```

c) Update `saveProps` in the render section — remove `isSaved`:
```typescript
const saveProps = { status, isSaving, saveError, onSave: handleSave }
```

`PlanCalendar` and `PlanFeed` receive `saveProps` and pass it to `SavePlanButton` — since Step 1 removed `isSaved` from the `SaveProps` type, TypeScript will flag any remaining references in those files at the typecheck step below.

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors. If TypeScript reports `isSaved` errors in `plan-calendar.tsx` or `plan-feed.tsx`, search those files for `isSaved` and remove any reference.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/plan/page.tsx apps/web/app/plan/save-plan-button.tsx
git commit -m "feat: redirect to /dashboard after saving plan, handle 401 in save flow"
```

---

## Chunk 3: Dashboard

### Task 6: Create `DashboardHeader` component

**Files:**
- Create: `apps/web/app/dashboard/dashboard-header.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client"

import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

interface DashboardHeaderProps {
  name: string | null | undefined
  email: string
  image: string | null | undefined
}

function getInitials(name: string | null | undefined, email: string): string {
  if (!name?.trim()) return (email[0] ?? "?").toUpperCase()
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0]![0] ?? "").toUpperCase()
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase()
}

export function DashboardHeader({ name, email, image }: DashboardHeaderProps) {
  const router = useRouter()

  async function handleSignOut() {
    try {
      await authClient.signOut()
    } finally {
      router.replace("/")
    }
  }

  const initials = getInitials(name, email)

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
        <span className="text-lg font-semibold tracking-tight">Athloryx</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden bg-muted text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
              {image ? (
                <img src={image} alt={name ?? email} className="h-full w-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5">
                {name && <p className="text-sm font-semibold leading-none">{name}</p>}
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => void handleSignOut()}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dashboard/dashboard-header.tsx
git commit -m "feat: add DashboardHeader with avatar dropdown"
```

---

### Task 7: Create `WorkoutCard` component

**Files:**
- Create: `apps/web/app/dashboard/workout-card.tsx`

This component renders a single day card for the dashboard. The parent computes which state to show and passes a discriminated union.

- [ ] **Step 1: Create the file**

```typescript
import { format, parseISO } from "date-fns"
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
}

export function WorkoutCard({ state, dateISO, units, variant }: WorkoutCardProps) {
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
        {isHero && (
          <p className="mt-1 text-sm text-muted-foreground">Recovery is part of training.</p>
        )}
      </div>
    )
  }

  // state.kind === "workout"
  const { entry } = state
  const textClass = WORKOUT_TEXT_CLASS[entry.type]
  const inlineColor = getWorkoutColor(entry.type)

  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${isHero ? "" : "opacity-60"}`}>
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
      {isHero && (
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {entry.description}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dashboard/workout-card.tsx
git commit -m "feat: add WorkoutCard component for dashboard day display"
```

---

### Task 8: Create `WeekList` component

**Files:**
- Create: `apps/web/app/dashboard/week-list.tsx`

Shows remaining days of the current week (today+2 through Sunday of the current Mon–Sun week). Omitted if today is Saturday or Sunday.

- [ ] **Step 1: Create the file**

```typescript
import Link from "next/link"
import { format, parseISO } from "date-fns"
import type { WorkoutDay } from "@workspace/ai"
import {
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
} from "@/app/plan/workout-utils"

interface WeekListProps {
  days: WorkoutDay[]
  todayISO: string
  planId: string
  units: "km" | "miles"
}

/** Returns the ISO dates from day-after-tomorrow through Sunday of the current
 *  Mon–Sun week. Returns an empty array if today is Saturday or Sunday. */
function getThisWeekDates(todayISO: string): string[] {
  const today = new Date(todayISO + "T00:00:00") // parse as local midnight
  const dayOfWeek = today.getDay() // 0=Sun, 1=Mon … 6=Sat
  const daysUntilSunday = (7 - dayOfWeek) % 7 // 0 if today is Sunday

  const sunday = new Date(today)
  sunday.setDate(today.getDate() + daysUntilSunday)

  const startFrom = new Date(today)
  startFrom.setDate(today.getDate() + 2)

  if (startFrom > sunday) return [] // today is Sat or Sun

  const dates: string[] = []
  const cur = new Date(startFrom)
  while (cur <= sunday) {
    dates.push(cur.toLocaleDateString("en-CA"))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export function WeekList({ days, todayISO, planId, units }: WeekListProps) {
  const weekDates = getThisWeekDates(todayISO)
  if (weekDates.length === 0) return null

  // Build a lookup: date → entries
  const byDate = new Map<string, WorkoutDay[]>()
  for (const day of days) {
    const existing = byDate.get(day.date) ?? []
    existing.push(day)
    byDate.set(day.date, existing)
  }

  return (
    <section className="space-y-1">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1 pb-1">
        This Week
      </h2>
      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {weekDates.map((dateISO) => {
          const entries = (byDate.get(dateISO) ?? []).filter((e) => e.type !== "rest")
          const dayLabel = format(parseISO(dateISO), "EEE")

          if (entries.length === 0) {
            return (
              <Link
                key={dateISO}
                href={`/plan/${planId}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors opacity-50"
              >
                <span className="w-8 text-sm font-medium">{dayLabel}</span>
                <span className="text-xs text-muted-foreground">Rest</span>
              </Link>
            )
          }

          return entries.map((entry, i) => {
            const textClass = WORKOUT_TEXT_CLASS[entry.type]
            const inlineColor = getWorkoutColor(entry.type)
            return (
              <Link
                key={`${dateISO}-${i}`}
                href={`/plan/${planId}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <span className="w-8 text-sm font-medium">{dayLabel}</span>
                <span
                  className={`flex-1 text-sm ${textClass}`}
                  style={inlineColor ? { color: inlineColor } : undefined}
                >
                  {WORKOUT_NAMES[entry.type]}
                </span>
                {entry.distanceKm !== undefined && (
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatDistance(entry.distanceKm, units)} {distanceUnit(units)}
                  </span>
                )}
              </Link>
            )
          })
        })}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dashboard/week-list.tsx
git commit -m "feat: add WeekList component for dashboard this-week section"
```

---

### Task 9: Create the Dashboard page

**Files:**
- Create: `apps/web/app/dashboard/page.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import type { WorkoutDay, PlanGenerationInput } from "@workspace/ai"
import { DashboardHeader } from "./dashboard-header"
import { WorkoutCard, type DayCardState } from "./workout-card"
import { WeekList } from "./week-list"
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

function resolveDayState(
  entries: WorkoutDay[],
  dateISO: string,
  planStartDate: string,
  planEndDate: string,
): DayCardState {
  if (dateISO < planStartDate) return { kind: "before-start", startDate: planStartDate }
  if (dateISO > planEndDate) return { kind: "after-end" }
  const workouts = entries.filter((e) => e.type !== "rest")
  if (workouts.length === 0) return { kind: "rest" }
  return { kind: "workout", entry: workouts[0]! } // caller renders one card per workout
}

export default function DashboardPage() {
  const router = useRouter()
  const { data: sessionData, isPending: sessionPending } = authClient.useSession()

  const [plan, setPlan] = useState<Plan | null | "empty" | "error">(null)
  const [fetching, setFetching] = useState(false)

  const fetchPlan = useCallback(async () => {
    setFetching(true)
    try {
      const res = await fetch("/api/plans")
      if (res.status === 401) {
        router.replace("/")
        return
      }
      if (!res.ok) {
        setPlan("error")
        return
      }
      const data = (await res.json()) as { plans: Plan[] }
      setPlan(data.plans.length > 0 ? data.plans[0]! : "empty")
    } catch {
      setPlan("error")
    } finally {
      setFetching(false)
    }
  }, [router])

  // Redirect to / if no session once resolved
  useEffect(() => {
    if (!sessionPending && !sessionData?.session) {
      router.replace("/")
    }
  }, [sessionPending, sessionData?.session, router])

  // Fetch plan once session is confirmed
  useEffect(() => {
    if (!sessionPending && sessionData?.session) {
      void fetchPlan()
    }
  }, [sessionPending, sessionData?.session, fetchPlan])

  // Show spinner while session is loading or plan is fetching
  if (sessionPending || fetching || plan === null) {
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
          <Button variant="outline" onClick={() => void fetchPlan()}>
            Retry
          </Button>
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
          <Button asChild>
            <Link href="/">Create a Plan</Link>
          </Button>
        </div>
      </main>
    )
  }

  // Resolved plan
  const todayISO = getTodayISO()
  const tomorrowISO = addDays(todayISO, 1)
  const planStartDate = plan.days[0]?.date ?? todayISO
  const planEndDate = plan.days[plan.days.length - 1]?.date ?? todayISO
  const units = plan.input.units

  // Build date → entries lookup
  const byDate = new Map<string, WorkoutDay[]>()
  for (const day of plan.days) {
    const existing = byDate.get(day.date) ?? []
    existing.push(day)
    byDate.set(day.date, existing)
  }

  const todayEntries = byDate.get(todayISO) ?? []
  const tomorrowEntries = byDate.get(tomorrowISO) ?? []

  // Compute workout-level entries (non-rest) for multi-card rendering
  const todayWorkouts = todayEntries.filter((e) => e.type !== "rest")
  const tomorrowWorkouts = tomorrowEntries.filter((e) => e.type !== "rest")

  const todayOutOfRange =
    todayISO < planStartDate
      ? ({ kind: "before-start", startDate: planStartDate } as DayCardState)
      : todayISO > planEndDate
        ? ({ kind: "after-end" } as DayCardState)
        : null

  const tomorrowOutOfRange =
    tomorrowISO < planStartDate
      ? ({ kind: "before-start", startDate: planStartDate } as DayCardState)
      : tomorrowISO > planEndDate
        ? ({ kind: "after-end" } as DayCardState)
        : null

  return (
    <main className="min-h-svh">
      <DashboardHeader name={user.name} email={user.email} image={user.image} />

      <div className="mx-auto max-w-xl px-4 py-6 space-y-8">

        {/* Today */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
            Today
          </h2>
          {todayOutOfRange ? (
            <WorkoutCard
              state={todayOutOfRange}
              dateISO={todayISO}
              units={units}
              variant="hero"
            />
          ) : todayWorkouts.length === 0 ? (
            <WorkoutCard
              state={{ kind: "rest" }}
              dateISO={todayISO}
              units={units}
              variant="hero"
            />
          ) : (
            todayWorkouts.map((entry, i) => (
              <WorkoutCard
                key={i}
                state={{ kind: "workout", entry }}
                dateISO={todayISO}
                units={units}
                variant="hero"
              />
            ))
          )}
        </section>

        {/* Tomorrow */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
            Tomorrow
          </h2>
          {tomorrowOutOfRange ? (
            <WorkoutCard
              state={tomorrowOutOfRange}
              dateISO={tomorrowISO}
              units={units}
              variant="preview"
            />
          ) : tomorrowWorkouts.length === 0 ? (
            <WorkoutCard
              state={{ kind: "rest" }}
              dateISO={tomorrowISO}
              units={units}
              variant="preview"
            />
          ) : (
            tomorrowWorkouts.map((entry, i) => (
              <WorkoutCard
                key={i}
                state={{ kind: "workout", entry }}
                dateISO={tomorrowISO}
                units={units}
                variant="preview"
              />
            ))
          )}
        </section>

        {/* This Week */}
        <WeekList
          days={plan.days}
          todayISO={todayISO}
          planId={plan.id}
          units={units}
        />

        {/* View Full Plan */}
        <div className="pt-2 text-center">
          <Link
            href={`/plan/${plan.id}`}
            className="text-sm text-primary hover:underline"
          >
            View Full Plan →
          </Link>
        </div>

      </div>
    </main>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual test**

1. Sign in via Google OAuth (or magic link).
2. Save a plan — you should be redirected to `/dashboard`.
3. Dashboard should show today's workout as a hero card.
4. Avatar in top right should show your initials or Google photo.
5. Clicking avatar should show name + email + Sign out.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/dashboard/page.tsx
git commit -m "feat: add /dashboard page with today/tomorrow/this-week workout display"
```

---

## Chunk 4: Read-Only Plan View

### Task 10: Create `/plan/[id]/page.tsx`

**Files:**
- Create: `apps/web/app/plan/[id]/page.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import type { WorkoutDay, PlanGenerationInput } from "@workspace/ai"
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
      })
      .catch(() => setPlan("not-found"))
      .finally(() => setFetching(false))
  }, [id, sessionPending, sessionData?.session])

  if (sessionPending || fetching || plan === null) {
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
          days={plan.days}
          units={units}
          totalWeeks={plan.totalWeeks}
          raceDistance={raceDistance}
        />
      </div>

      {/* Mobile: feed */}
      <div className="md:hidden flex-1 overflow-y-auto pt-2">
        <PlanFeed
          days={plan.days}
          units={units}
          totalWeeks={plan.totalWeeks}
          raceDistance={raceDistance}
        />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Update `PlanHeader` to accept a `backHref` prop**

The current `PlanHeader` hard-codes `href="/"` on the back link. It needs to accept an optional `backHref` prop so `/plan/[id]` can point back to `/dashboard`.

Open `apps/web/app/plan/plan-header.tsx` and:

a) Add `backHref?: string` to the `PlanHeaderProps` interface:

```typescript
interface PlanHeaderProps {
  planName: string
  totalWeeks: number
  totalKm: number
  units: "km" | "miles"
  status: "generating" | "complete" | "error"
  generatingWeek?: number
  goalTimeLabel?: string
  backHref?: string
}
```

b) Destructure `backHref` in the component:

```typescript
export function PlanHeader({
  planName,
  totalWeeks,
  totalKm,
  units,
  status,
  generatingWeek,
  goalTimeLabel,
  backHref = "/",
}: PlanHeaderProps) {
```

c) Update the back `<Link>` to use `backHref`:

```tsx
<Link
  href={backHref}
  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
>
  <ChevronLeft className="h-4 w-4" />
  Back
</Link>
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Manual test**

1. Go to `/dashboard`.
2. Click "View Full Plan →".
3. Expected: full calendar/feed renders with the saved plan data.
4. Expected: header shows plan name, weeks, km. Back link goes to `/dashboard`.
5. No save button visible.

- [ ] **Step 5: Final commit**

```bash
git add apps/web/app/plan/[id]/page.tsx apps/web/app/plan/plan-header.tsx
git commit -m "feat: add /plan/[id] read-only view and backHref prop to PlanHeader"
```
