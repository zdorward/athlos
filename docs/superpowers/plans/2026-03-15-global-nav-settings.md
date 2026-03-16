# Global Nav & Settings Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent global nav (desktop top bar + mobile bottom tabs) and a settings page with km/miles units preference to all authenticated pages.

**Architecture:** A Next.js route group `app/(app)/` provides a shared Server Component layout that does the auth guard and renders `AppNav`. Authenticated pages (`/dashboard`, `/plan/[id]`, `/settings`) are moved into this group. A `units` column on the `user` table (with Better Auth `additionalFields`) makes the preference available on `session.user`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Better Auth, Drizzle ORM (Neon PostgreSQL), lucide-react, shadcn/ui (DropdownMenu, Button)

---

## Chunk 1: Data Layer — DB, Auth Config, API

## Task 1: Add `units` field to DB schema and Better Auth config

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `apps/web/lib/auth.ts`
- Modify: `apps/web/lib/auth-client.ts`

This project has no automated tests — verification is done via `pnpm typecheck` and `pnpm lint`.

- [ ] **Step 1: Add `units` column to the user table**

In `packages/db/src/schema.ts`, find the `user` table definition and add the `units` field after `updatedAt`:

```ts
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  units: text("units").notNull().default("km"),
})
```

- [ ] **Step 2: Run the DB migration**

```bash
cd /Users/zackdorward/dev/athlos/packages/db
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

Expected: new migration file generated, migration applied to Neon DB with no errors.

- [ ] **Step 3: Add `additionalFields` to Better Auth server config**

In `apps/web/lib/auth.ts`, update the `betterAuth({...})` call inside `createAuth()` to add a `user` config block. Insert it between `socialProviders` and `plugins`:

```ts
function createAuth() {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET!,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },
    user: {
      additionalFields: {
        units: {
          type: "string",
          defaultValue: "km",
          required: false,
        },
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await new Resend(process.env.RESEND_API_KEY).emails.send({
            from: "Athlos <hello@athlos.run>",
            to: email,
            subject: "Sign in to Athlos",
            html: `<p>Click the link below to sign in to Athlos:</p><p><a href="${url}">${url}</a></p>`,
          })
        },
      }),
    ],
  })
}
```

- [ ] **Step 4: Add `inferAdditionalFields` to Better Auth client config**

Replace the entire content of `apps/web/lib/auth-client.ts` with:

```ts
import { createAuthClient } from "better-auth/react"
import { magicLinkClient, inferAdditionalFields } from "better-auth/client/plugins"
import type { auth } from "./auth"

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), inferAdditionalFields<typeof auth>()],
})
```

This makes `session.user.units` correctly typed on the client side.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/zackdorward/dev/athlos
git add packages/db/src/schema.ts apps/web/lib/auth.ts apps/web/lib/auth-client.ts
git add packages/db/drizzle  # migration files
git commit -m "feat: add units field to user table and Better Auth config"
```

---

## Task 2: Add `PATCH /api/user` endpoint

**Files:**
- Create: `apps/web/app/api/user/route.ts`

- [ ] **Step 1: Create the route file**

Create `apps/web/app/api/user/route.ts` with this content:

```ts
import { type NextRequest } from "next/server"
import { headers } from "next/headers"
import { z } from "zod"
import { auth } from "@/lib/auth"

const bodySchema = z.object({
  units: z.enum(["km", "miles"]),
})

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { units: "km" | "miles" }
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }

  await auth.api.updateUser({
    body: { units: body.units },
    headers: await headers(),
  })

  return Response.json({ units: body.units })
}
```

Note: `auth.api.updateUser` goes through Better Auth's own session layer, so `session.user.units` updates immediately on subsequent `useSession()` calls without a page reload.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/zackdorward/dev/athlos
git add apps/web/app/api/user/route.ts
git commit -m "feat: add PATCH /api/user endpoint for units preference"
```

---

## Chunk 2: Route Group, Layout, and AppNav

## Task 3: Create `(app)` route group layout

**Files:**
- Create: `apps/web/app/(app)/layout.tsx`

The `(app)` route group is a Next.js folder naming convention — the parentheses mean it creates a layout scope without affecting URLs. `/dashboard` is still `/dashboard`.

- [ ] **Step 1: Create the layout file**

Create `apps/web/app/(app)/layout.tsx`:

```tsx
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { eq, desc } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans } from "@workspace/db"
import { AppNav } from "./components/app-nav"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/")

  const userPlans = await db
    .select({ id: plans.id })
    .from(plans)
    .where(eq(plans.userId, session.user.id))
    .orderBy(desc(plans.createdAt))
    .limit(1)

  const planHref = userPlans[0] ? `/plan/${userPlans[0].id}` : "/plan-empty"

  return (
    <div>
      <AppNav
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
        }}
        planHref={planHref}
      />
      <main className="md:pt-16 pb-16 md:pb-0">
        {children}
      </main>
    </div>
  )
}
```

- `md:pt-16` — clears the fixed top nav bar on desktop (`h-16`)
- `pb-16 md:pb-0` — clears the fixed bottom tab bar on mobile; removed on desktop

- [ ] **Step 2: Typecheck (will fail until AppNav is created — that's expected)**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck 2>&1 | grep -i "app-nav" | head -5
```

Expected: error about `app-nav` module not found. This is expected — Task 4 creates it.

- [ ] **Step 3: Commit (component stub will be created in Task 4)**

Skip commit — commit together with AppNav in Task 4.

---

## Task 4: Create `AppNav` component

**Files:**
- Create: `apps/web/app/(app)/components/app-nav.tsx`

This is a Client Component (needs `usePathname()`). It renders a fixed top bar on `md+` and a fixed bottom tab bar on mobile.

- [ ] **Step 1: Create the component file**

Create `apps/web/app/(app)/components/app-nav.tsx`:

```tsx
"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { LayoutDashboard, CalendarDays, Settings, User } from "lucide-react"
import { Wordmark } from "@/components/wordmark"
import { authClient } from "@/lib/auth-client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

interface AppNavProps {
  user: {
    name: string | null | undefined
    email: string
    image: string | null
  }
  planHref: string
}

export function AppNav({ user, planHref }: AppNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [imgError, setImgError] = useState(false)

  const tabs = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, activePrefix: "/dashboard" },
    { label: "Plan", href: planHref, icon: CalendarDays, activePrefix: "/plan" },
    { label: "Settings", href: "/settings", icon: Settings, activePrefix: "/settings" },
  ]

  function isActive(prefix: string) {
    return pathname.startsWith(prefix)
  }

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/")
  }

  const showImage = user.image && !imgError

  return (
    <>
      {/* ── Desktop top bar (md+) ──────────────────────────────────────────── */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-16 items-center justify-between border-b border-border bg-background px-6">
        {/* Left: wordmark */}
        <Link href="/dashboard" className="flex items-center">
          <Wordmark />
        </Link>

        {/* Center-left: nav links */}
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive(tab.activePrefix)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {/* Right: user avatar + dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden bg-muted text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
              {showImage ? (
                <img
                  src={user.image!}
                  alt={user.name ?? user.email}
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="h-4 w-4" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5">
                {user.name && <p className="text-sm font-semibold leading-none">{user.name}</p>}
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => void handleSignOut()}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* ── Mobile bottom tab bar (<md) ────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-background"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabs.map((tab) => {
          const active = isActive(tab.activePrefix)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit layout + AppNav together**

```bash
cd /Users/zackdorward/dev/athlos
git add apps/web/app/\(app\)/layout.tsx apps/web/app/\(app\)/components/app-nav.tsx
git commit -m "feat: add (app) route group layout with auth guard and AppNav"
```

---

## Chunk 3: Migrate Pages, New Pages, Cleanup

## Task 5: Move `dashboard/` into `(app)/` and update it

**Files:**
- Create: `apps/web/app/(app)/dashboard/page.tsx` (replaces `app/dashboard/page.tsx`)
- Create: `apps/web/app/(app)/dashboard/race-banner.tsx` (moved)
- Create: `apps/web/app/(app)/dashboard/today-workout-card.tsx` (moved)
- Delete: `apps/web/app/dashboard/page.tsx`
- Delete: `apps/web/app/dashboard/dashboard-header.tsx`
- Delete: `apps/web/app/dashboard/race-banner.tsx`
- Delete: `apps/web/app/dashboard/today-workout-card.tsx`

Changes to `dashboard/page.tsx`:
1. Remove `DashboardHeader` import and all 3 usages of `<DashboardHeader ...>`
2. Remove the auth-redirect `useEffect` (layout now handles it)
3. Change `const units = resolvedPlan.input.units` to read from session

- [ ] **Step 1: Move race-banner.tsx and today-workout-card.tsx**

```bash
cd /Users/zackdorward/dev/athlos/apps/web/app
mkdir -p \(app\)/dashboard
mv dashboard/race-banner.tsx \(app\)/dashboard/race-banner.tsx
mv dashboard/today-workout-card.tsx \(app\)/dashboard/today-workout-card.tsx
```

No content changes needed — these components have no dependency on `DashboardHeader`.

- [ ] **Step 2: Create the new `(app)/dashboard/page.tsx`**

Create `apps/web/app/(app)/dashboard/page.tsx` with the full updated content below. Key changes from the original:
- Removed `DashboardHeader` import
- Removed the auth-redirect `useEffect` (lines 77-79 of original)
- Replaced `const units = resolvedPlan.input.units` with `const units = (sessionData?.user as { units?: "km" | "miles" } | undefined)?.units ?? "km"`
- Removed `<DashboardHeader ...>` from all 3 render paths (error, empty, main)

```tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import type { WorkoutDay, PlanGenerationInput } from "@workspace/ai"
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

function getEntriesForDate(days: WorkoutDay[], dateISO: string): WorkoutDay[] {
  return days.filter((d) => d.date === dateISO)
}

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
    if (!sessionPending && sessionData?.session) void fetchPlan()
  }, [sessionPending, sessionData?.session, fetchPlan])

  if (plan === null) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (plan === "error") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <p className="text-muted-foreground">Unable to load your plan. Please try again.</p>
        <Button variant="outline" onClick={() => void fetchPlan()}>Retry</Button>
      </div>
    )
  }

  if (plan === "empty") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <p className="text-muted-foreground">You don&apos;t have a saved plan yet.</p>
        <Button asChild><Link href="/?new=1">Create a Plan</Link></Button>
      </div>
    )
  }

  const resolvedPlan = plan as Plan

  function handleComplete(entry: WorkoutDay) {
    const prevDays = resolvedPlan.days
    const updated = resolvedPlan.days.map((d: WorkoutDay) =>
      d.date === entry.date && d.type === entry.type ? { ...d, completed: true } : d
    )
    setPlan((p) => (p === null || typeof p === "string" ? p : ({ ...p, days: updated } as Plan)))
    fetch(`/api/plans/${resolvedPlan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: entry.date, type: entry.type, completed: true }),
    }).then((res) => {
      if (!res.ok) throw new Error()
    }).catch(() => {
      setPlan((p) => (p === null || typeof p === "string" ? p : ({ ...p, days: prevDays } as Plan)))
    })
  }

  function handleLogEffort(entry: WorkoutDay, effort: "hard" | "good" | "easy") {
    const prevDays = resolvedPlan.days
    const updated = resolvedPlan.days.map((d: WorkoutDay) =>
      d.date === entry.date && d.type === entry.type ? { ...d, effort } : d
    )
    setPlan((p) => (p === null || typeof p === "string" ? p : ({ ...p, days: updated } as Plan)))
    fetch(`/api/plans/${resolvedPlan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: entry.date, type: entry.type, effort }),
    }).then((res) => {
      if (!res.ok) throw new Error()
    }).catch(() => {
      setPlan((p) => (p === null || typeof p === "string" ? p : ({ ...p, days: prevDays } as Plan)))
    })
  }

  const todayISO = getTodayISO()
  // Read units from user preference; fall back to plan input for backwards compat
  const units = (sessionData?.user as { units?: "km" | "miles" } | undefined)?.units
    ?? resolvedPlan.input.units
    ?? "km"
  const raceDateISO = resolvedPlan.input.race.date

  const sortedDays = [...resolvedPlan.days].sort((a, b) => a.date.localeCompare(b.date))
  const firstDayISO = sortedDays[0]?.date ?? null
  const lastDayISO = sortedDays[sortedDays.length - 1]?.date ?? null

  const todayEntries = getEntriesForDate(resolvedPlan.days, todayISO)
  const todayWorkouts = todayEntries.filter((e) => e.type !== "rest")
  const isRestDay = todayWorkouts.length === 0
  const allTodayComplete = todayWorkouts.length > 0 && todayWorkouts.every((e) => e.completed === true)
  const isBeforePlanStart = firstDayISO !== null && todayISO < firstDayISO
  const isAfterRace = todayISO > raceDateISO
  const isPlanExhausted = !isAfterRace && lastDayISO !== null && todayISO > lastDayISO

  const showTomorrow = isRestDay || allTodayComplete
  const tomorrowDate = showTomorrow ? getNextWorkoutDate(resolvedPlan.days, todayISO) : null
  const tomorrowWorkouts = tomorrowDate
    ? getEntriesForDate(resolvedPlan.days, tomorrowDate).filter((e) => e.type !== "rest")
    : []

  return (
    <div className="mx-auto max-w-xl px-4 py-6 space-y-6">

      {!isAfterRace && (
        <RaceBanner
          input={resolvedPlan.input}
          days={resolvedPlan.days}
          totalWeeks={resolvedPlan.totalWeeks}
        />
      )}

      {isBeforePlanStart ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Your plan starts on {format(parseISO(firstDayISO!), "EEEE, MMM d")}.
          </p>
        </div>
      ) : isAfterRace || isPlanExhausted ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Your plan is complete 🎉</p>
        </div>
      ) : (
        <>
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

      <div className="pt-2 text-center">
        <Link
          href={`/plan/${resolvedPlan.id}`}
          className="text-sm text-primary hover:underline"
        >
          View full plan →
        </Link>
      </div>

    </div>
  )
}
```

- [ ] **Step 3: Delete old dashboard files**

```bash
cd /Users/zackdorward/dev/athlos/apps/web/app
rm dashboard/page.tsx dashboard/dashboard-header.tsx
rmdir dashboard  # only if empty — if not empty, that's fine too
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/zackdorward/dev/athlos
git add apps/web/app/\(app\)/dashboard/
git add -u apps/web/app/dashboard/  # stages deletions
git commit -m "feat: move dashboard into (app) route group; remove DashboardHeader; use session units"
```

---

## Task 6: Move `plan/[id]/` into `(app)/`

**Files:**
- Create: `apps/web/app/(app)/plan/[id]/page.tsx` (moved from `app/plan/[id]/page.tsx`)
- Delete: `apps/web/app/plan/[id]/page.tsx`

Change to the file: remove the auth-redirect `useEffect` (layout handles it). The `units` line (`const units = plan.input.units`) stays as-is for now — the plan view reads from the stored plan data which is fine for this page.

- [ ] **Step 1: Create `(app)/plan/[id]/` directory and move the file**

```bash
cd /Users/zackdorward/dev/athlos/apps/web/app
mkdir -p \(app\)/plan/\[id\]
cp plan/\[id\]/page.tsx \(app\)/plan/\[id\]/page.tsx
```

- [ ] **Step 2: Remove the auth-redirect `useEffect` from the moved file**

In `apps/web/app/(app)/plan/[id]/page.tsx`, find and remove these lines (around line 37-43 of the original):

```ts
// Redirect if no session — REMOVE THIS BLOCK
useEffect(() => {
  if (!sessionPending && !sessionData?.session) {
    router.replace("/")
  }
}, [sessionPending, sessionData?.session, router])
```

Also remove `useRouter` from the imports if it's no longer used after this removal. Check the file — `router` is used in `handleStartNewPlan` (`router.push("/?new=1")`), so keep `useRouter` and `const router = useRouter()`.

- [ ] **Step 3: Delete the old file**

```bash
cd /Users/zackdorward/dev/athlos/apps/web/app
rm plan/\[id\]/page.tsx
rmdir plan/\[id\]  # removes empty directory
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/zackdorward/dev/athlos
git add apps/web/app/\(app\)/plan/
git add -u apps/web/app/plan/\[id\]/  # stages deletions
git commit -m "feat: move plan/[id] into (app) route group; remove redundant auth redirect"
```

---

## Task 7: Create plan empty state page and settings page

**Files:**
- Create: `apps/web/app/(app)/plan-empty/page.tsx`
- Create: `apps/web/app/(app)/settings/page.tsx`

- [ ] **Step 1: Create `plan-empty/page.tsx`**

Create `apps/web/app/(app)/plan-empty/page.tsx`:

```tsx
"use client"

import Link from "next/link"
import { Button } from "@workspace/ui/components/button"

export default function PlanEmptyPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">No plan yet</h1>
      <p className="text-muted-foreground max-w-sm">
        Build a training plan tailored to your race and schedule.
      </p>
      <Button asChild>
        <Link href="/">Create a plan</Link>
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Create `settings/page.tsx`**

Create `apps/web/app/(app)/settings/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@workspace/ui/components/button"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
  const router = useRouter()
  const { data: sessionData } = authClient.useSession()
  const user = sessionData?.user

  // Cast to include the additional `units` field from Better Auth additionalFields config
  const currentUnits = (user as { units?: "km" | "miles" } | undefined)?.units ?? "km"
  const [units, setUnits] = useState<"km" | "miles">(currentUnits)
  const [saving, setSaving] = useState(false)

  async function handleUnitsChange(value: "km" | "miles") {
    if (value === units) return
    setUnits(value)
    setSaving(true)
    try {
      await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ units: value }),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      {/* Preferences */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Preferences
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Distance units</p>
            {saving && (
              <p className="text-xs text-muted-foreground">Saving…</p>
            )}
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["km", "miles"] as const).map((value) => (
              <button
                key={value}
                onClick={() => void handleUnitsChange(value)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  units === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Account */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Account
        </h2>

        <div className="space-y-1">
          {user?.name && (
            <p className="text-sm font-medium">{user.name}</p>
          )}
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        <Button variant="outline" onClick={() => void handleSignOut()}>
          Sign out
        </Button>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/zackdorward/dev/athlos
git add apps/web/app/\(app\)/plan-empty/ apps/web/app/\(app\)/settings/
git commit -m "feat: add plan-empty and settings pages"
```

---

## Task 8: End-to-end verification

- [ ] **Step 1: Run the dev server and verify desktop nav**

```bash
cd /Users/zackdorward/dev/athlos && pnpm dev
```

1. Sign in and navigate to `/dashboard` — confirm the top nav bar is visible on desktop with Wordmark, Dashboard · Plan · Settings links, and avatar dropdown
2. Confirm the active link is highlighted (Dashboard link active on `/dashboard`)
3. Click Plan — confirm it goes to your saved plan page (or `/plan-empty` if none)
4. Click Settings — confirm the settings page renders with the km/miles toggle and account section
5. Click avatar → Sign out — confirm redirect to `/`
6. Confirm the top nav does NOT appear on the plan generation page (`/`)

- [ ] **Step 2: Verify mobile nav**

Open DevTools and switch to mobile viewport (< 768px):
1. Confirm top bar is hidden
2. Confirm bottom tab bar is visible with Dashboard / Plan / Settings tabs
3. Confirm active tab is highlighted
4. Confirm content doesn't scroll behind the bottom bar

- [ ] **Step 3: Verify units setting**

1. Go to Settings, toggle to `miles`
2. Navigate to Dashboard — confirm workout distances show in miles
3. Toggle back to `km` — confirm distances update

- [ ] **Step 4: Verify no regressions**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck && pnpm lint
```

Expected: typecheck passes with no errors; lint shows warnings only (pre-existing).
