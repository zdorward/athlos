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
            todayWorkouts.map((entry) => (
              <WorkoutCard
                key={`${entry.date}-${entry.type}`}
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
            tomorrowWorkouts.map((entry) => (
              <WorkoutCard
                key={`${entry.date}-${entry.type}`}
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
