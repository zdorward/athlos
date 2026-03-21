"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format, parseISO } from "date-fns"
import Link from "next/link"
import type { WorkoutDay, PlanGenerationInput, PhaseEntry } from "@workspace/plan-engine"
import { RaceBanner } from "./race-banner"
import { TodayWorkoutCard } from "./today-workout-card"
import { Button } from "@workspace/ui/components/button"

export interface Plan {
  id: string
  name: string
  days: WorkoutDay[]
  phases?: PhaseEntry[]
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

function UpgradedBanner({ onShow }: { onShow: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get("upgraded") === "true") {
      onShow()
      router.replace("/dashboard")
    }
  }, [searchParams, router, onShow])
  return null
}

export function DashboardClient({
  initialPlan,
  units: serverUnits,
}: {
  initialPlan: Plan | "empty"
  units: string
}) {
  const router = useRouter()

  const [plan, setPlan] = useState<Plan | "empty" | "error">(initialPlan)
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(false)

  async function fetchPlan() {
    try {
      const res = await fetch("/api/plans")
      if (res.status === 401) { router.replace("/"); return }
      if (!res.ok) { setPlan("error"); return }
      const data = (await res.json()) as { plans: Plan[] }
      setPlan(data.plans.length > 0 ? data.plans[0]! : "empty")
    } catch {
      setPlan("error")
    }
  }

  if (plan === "error") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <p className="text-muted-foreground">Unable to load your plan. Please try again.</p>
        <Button variant="outline" onClick={() => void fetchPlan()}>Retry</Button>
        <div className="pt-2">
          <Link href="/settings" className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">Settings</Link>
        </div>
      </div>
    )
  }

  if (plan === "empty") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <p className="text-muted-foreground">You don&apos;t have a saved plan yet.</p>
        <Button asChild><Link href="/new-plan">Create a Plan</Link></Button>
        <div className="pt-2">
          <Link href="/settings" className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">Settings</Link>
        </div>
      </div>
    )
  }

  const resolvedPlan = plan as Plan

  function handleComplete(entry: WorkoutDay) {
    const prevDays = resolvedPlan.days
    const updated = resolvedPlan.days.map((d: WorkoutDay) =>
      d.date === entry.date && d.type === entry.type ? { ...d, completed: true } : d
    )
    setPlan((p) => (typeof p === "string" ? p : { ...p, days: updated } as Plan))
    fetch(`/api/plans/${resolvedPlan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: entry.date, type: entry.type, completed: true }),
    }).catch(() => {
      setPlan((p) => (typeof p === "string" ? p : { ...p, days: prevDays } as Plan))
    })
  }

  const todayISO = getTodayISO()
  const units = serverUnits as "km" | "miles"
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
    <main className="min-h-svh">
      <Suspense fallback={null}>
        <UpgradedBanner onShow={() => setShowUpgradedBanner(true)} />
      </Suspense>
      <div className="mx-auto max-w-xl px-4 py-6 space-y-6">

        {showUpgradedBanner && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 text-sm text-primary font-medium">
            Welcome to Athlos Pro!
          </div>
        )}

        {!isAfterRace && (
          <RaceBanner
            input={resolvedPlan.input}
            days={resolvedPlan.days}
            totalWeeks={resolvedPlan.totalWeeks}
            phases={resolvedPlan.phases}
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

        <div className="pt-4 text-center">
          <Link
            href="/settings"
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Settings
          </Link>
        </div>

      </div>

    </main>
  )
}
