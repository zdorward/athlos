"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import type { WorkoutDay, PlanGenerationInput } from "@workspace/ai"
import { DashboardHeader } from "./dashboard-header"
import { WorkoutCard } from "./workout-card"
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

function findNextWorkoutDay(days: WorkoutDay[], fromDateISO: string): string | null {
  const seen = new Set<string>()
  for (const day of days) {
    if (day.date >= fromDateISO && day.type !== "rest" && !day.completed) {
      seen.add(day.date)
    }
  }
  if (seen.size === 0) return null
  return [...seen].sort()[0]!
}

function getDayLabel(dateISO: string, todayISO: string, tomorrowISO: string): string {
  if (dateISO === todayISO) return "Today"
  if (dateISO === tomorrowISO) return "Tomorrow"
  return format(parseISO(dateISO), "EEEE, MMM d")
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

  // Show spinner only on initial load — don't flash on background session re-validation
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

  function handleComplete(entry: WorkoutDay) {
    if (typeof plan !== "object" || plan === null) return
    const prevDays = plan.days
    const updatedDays = plan.days.map((d) =>
      d.date === entry.date && d.type === entry.type ? { ...d, completed: true } : d,
    )
    setPlan((prev) =>
      prev && typeof prev !== "string"
        ? { ...prev, days: updatedDays }
        : prev,
    )
    fetch(`/api/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: entry.date, type: entry.type, completed: true }),
    }).catch(() => {
      setPlan((prev) =>
        prev && typeof prev !== "string"
          ? { ...prev, days: prevDays }
          : prev,
      )
    })
  }

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

  return (
    <main className="min-h-svh">
      <DashboardHeader name={user.name} email={user.email} image={user.image} />

      <div className="mx-auto max-w-xl px-4 py-6 space-y-8">

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
                onComplete={() => handleComplete(entry)}
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
