// apps/web/app/(app)/dashboard/page.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format, parseISO } from "date-fns"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import type { WorkoutDay, PlanGenerationInput } from "@workspace/ai"
import { RaceBanner } from "./race-banner"
import { TodayWorkoutCard } from "./today-workout-card"
import { Button } from "@workspace/ui/components/button"
import { WorkoutFeedbackSheet, type AdaptationSuggestion } from "./workout-feedback-sheet"
import { AdaptationSuggestionCard } from "./adaptation-suggestion-card"

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
  const [feedbackEntry, setFeedbackEntry] = useState<WorkoutDay | null>(null)
  const [suggestion, setSuggestion] = useState<AdaptationSuggestion | null>(null)

  const searchParams = useSearchParams()
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(false)

  useEffect(() => {
    if (searchParams.get("upgraded") === "true") {
      setShowUpgradedBanner(true)
      router.replace("/dashboard")
    }
  }, [searchParams, router])

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
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (plan === "error") {
    return (
      <main className="min-h-svh">
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
        <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
          <p className="text-muted-foreground">You don&apos;t have a saved plan yet.</p>
          <Button asChild><Link href="/?new=1">Create a Plan</Link></Button>
        </div>
      </main>
    )
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  // At this point plan is a resolved Plan object (null/"error"/"empty" are handled above)
  const resolvedPlan = plan as Plan

  function handleComplete(entry: WorkoutDay) {
    setFeedbackEntry(entry)
  }

  function handleFeedbackDismiss() {
    if (!feedbackEntry) return
    const entry = feedbackEntry
    setFeedbackEntry(null)
    // User dismissed the sheet — mark complete without logging
    const prevDays = resolvedPlan.days
    const updated = resolvedPlan.days.map((d: WorkoutDay) =>
      d.date === entry.date && d.type === entry.type ? { ...d, completed: true } : d
    )
    setPlan((p) => (p === null || typeof p === "string" ? p : { ...p, days: updated } as Plan))
    fetch(`/api/plans/${resolvedPlan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: entry.date, type: entry.type, completed: true }),
    }).catch(() => {
      setPlan((p) => (p === null || typeof p === "string" ? p : { ...p, days: prevDays } as Plan))
    })
  }

  function handleFeedbackLogged(newSuggestion: AdaptationSuggestion | null) {
    if (!feedbackEntry) return
    const entry = feedbackEntry
    setFeedbackEntry(null)
    // Update completed in local plan state
    const updated = resolvedPlan.days.map((d: WorkoutDay) =>
      d.date === entry.date && d.type === entry.type ? { ...d, completed: true } : d
    )
    setPlan((p) => (p === null || typeof p === "string" ? p : { ...p, days: updated } as Plan))
    if (newSuggestion) setSuggestion(newSuggestion)
  }

  function handleSuggestionAccepted(updatedDays: WorkoutDay[]) {
    setPlan((p) => (p === null || typeof p === "string" ? p : { ...p, days: updatedDays } as Plan))
    setSuggestion(null)
  }

  function handleSuggestionDismissed() {
    setSuggestion(null)
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const todayISO = getTodayISO()
  const units = (sessionData?.user as { units?: "km" | "miles" } | undefined)?.units
    ?? resolvedPlan.input.units
    ?? "km"
  const raceDateISO = resolvedPlan.input.race.date

  // Sort days once for stable first/last date lookups
  const sortedDays = [...resolvedPlan.days].sort((a, b) => a.date.localeCompare(b.date))
  const firstDayISO = sortedDays[0]?.date ?? null
  const lastDayISO = sortedDays[sortedDays.length - 1]?.date ?? null

  // Today's entries
  const todayEntries = getEntriesForDate(resolvedPlan.days, todayISO)
  const todayWorkouts = todayEntries.filter((e) => e.type !== "rest")
  // Gap days (no entries at all) are treated the same as rest days —
  // the plan generator assigns every day an entry, so this is a defensive fallback.
  const isRestDay = todayWorkouts.length === 0
  const allTodayComplete = todayWorkouts.length > 0 && todayWorkouts.every((e) => e.completed === true)
  const isBeforePlanStart = firstDayISO !== null && todayISO < firstDayISO
  const isAfterRace = todayISO > raceDateISO
  // Plan exhausted: race hasn't passed but all workouts are in the past and today has none
  const isPlanExhausted = !isAfterRace && lastDayISO !== null && todayISO > lastDayISO

  // Tomorrow preview — show when rest day or all today complete
  const showTomorrow = isRestDay || allTodayComplete
  const tomorrowDate = showTomorrow ? getNextWorkoutDate(resolvedPlan.days, todayISO) : null
  const tomorrowWorkouts = tomorrowDate
    ? getEntriesForDate(resolvedPlan.days, tomorrowDate).filter((e) => e.type !== "rest")
    : []

  return (
    <main className="min-h-svh">
      <div className="mx-auto max-w-xl px-4 py-6 space-y-6">

        {showUpgradedBanner && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 text-sm text-primary font-medium">
            Welcome to Athlos Pro!
          </div>
        )}
        {/* Race banner — hidden after race date */}
        {!isAfterRace && (
          <RaceBanner
            input={resolvedPlan.input}
            days={resolvedPlan.days}
            totalWeeks={resolvedPlan.totalWeeks}
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
            {/* Adaptation suggestion */}
            {suggestion && (
              <AdaptationSuggestionCard
                suggestion={suggestion}
                planId={resolvedPlan.id}
                onAccepted={handleSuggestionAccepted}
                onDismissed={handleSuggestionDismissed}
              />
            )}

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
            href={`/plan/${resolvedPlan.id}`}
            className="text-sm text-primary hover:underline"
          >
            View full plan →
          </Link>
        </div>

      </div>

      <WorkoutFeedbackSheet
        open={feedbackEntry !== null}
        entry={feedbackEntry}
        planId={resolvedPlan.id}
        onLogged={handleFeedbackLogged}
        onDismiss={handleFeedbackDismiss}
      />
    </main>
  )
}
