"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { PlanGenerationInput, TrainingPlan, WorkoutDay, WorkoutType } from "@workspace/ai"
import { authClient } from "@/lib/auth-client"
import { PlanHeader } from "./plan-header"
import { PlanCalendar } from "./plan-calendar"
import { PlanFeed } from "./plan-feed"
import { SignInSheet } from "./sign-in-sheet"

const SESSION_KEY = "athlos_onboarding"
const PLAN_KEY = "athlos_plan"

interface SavedPlanSnapshot {
  input: PlanGenerationInput
  days: WorkoutDay[]
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
}

function mapToInput(raw: Record<string, unknown>): PlanGenerationInput | null {
  const goal = raw["goal"] as string | undefined
  const selectedDays = raw["selectedDays"] as string[] | undefined
  const longRunDay = raw["longRunDay"] as string | undefined

  if (!goal || !selectedDays?.length || !longRunDay) return null
  if (goal !== "race" || !raw["race"]) return null

  const race = raw["race"] as Record<string, unknown>
  const strengthDays = raw["strengthDays"] as string[] | undefined
  const input: PlanGenerationInput = {
    goal: "race",
    race: {
      name: String(race["name"] ?? ""),
      date: String(race["date"] ?? ""),
      distance: race["distance"] as "5k" | "10k" | "half" | "full" | "ultra",
      city: String(race["city"] ?? ""),
    },
    selectedDays,
    longRunDay,
    units: "km",
    strengthTraining: Array.isArray(strengthDays) && strengthDays.length > 0,
    strengthDays,
  }

  if (raw["timeGoal"] === true && raw["goalTime"]) {
    const gt = raw["goalTime"] as Record<string, unknown>
    input.goalTime = {
      hours: Number(gt["hours"] ?? 0),
      minutes: Number(gt["minutes"] ?? 0),
    }
  }

  return input
}

function goalTimeLabel(input: PlanGenerationInput): string | undefined {
  if (!input.goalTime) return undefined
  const { hours, minutes } = input.goalTime
  return `${hours}:${minutes.toString().padStart(2, "0")}`
}

function planName(input: PlanGenerationInput): string {
  if (input.goal === "race" && input.race) return input.race.name
  return "Aerobic Base Plan"
}

export default function PlanPage() {
  const router = useRouter()
  const { data: sessionData, isPending: sessionPending } = authClient.useSession()

  const [plan, setPlan] = useState<Partial<TrainingPlan>>({ days: [] })
  const [status, setStatus] = useState<"generating" | "complete" | "error">("generating")
  const [generatingWeek, setGeneratingWeek] = useState(1)
  const [input, setInput] = useState<PlanGenerationInput | null>(null)

  const [selectedKey, setSelectedKey] = useState<{ date: string; type: WorkoutType } | null>(null)

  // Save state
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [showSignInSheet, setShowSignInSheet] = useState(false)

  // Refs to avoid stale closures inside the async stream loop
  const totalWeeksRef = useRef(0)
  const dayCountRef = useRef(0)
  const startDateRef = useRef<string | null>(null)
  const planRef = useRef<Partial<TrainingPlan>>({ days: [] })
  const streamStartedRef = useRef(false)

  // Keep planRef in sync with plan state for use in callbacks
  useEffect(() => { planRef.current = plan }, [plan])

  // ── Auto-save after OAuth redirect ────────────────────────────────────────
  useEffect(() => {
    if (!sessionData?.session) return
    const raw = sessionStorage.getItem(PLAN_KEY)
    if (!raw) return

    // Guard: don't restore stale sessionStorage from a previous visit
    // if a stream is already in progress (totalWeeksRef.current > 0)
    if (totalWeeksRef.current > 0) {
      sessionStorage.removeItem(PLAN_KEY)
      return
    }

    sessionStorage.removeItem(PLAN_KEY)

    let snapshot: SavedPlanSnapshot
    try {
      snapshot = JSON.parse(raw) as SavedPlanSnapshot
    } catch {
      return
    }

    // Restore plan state from snapshot and trigger save.
    // Mark stream as started so the streaming effect doesn't fire a new generation.
    streamStartedRef.current = true
    setInput(snapshot.input)
    setPlan({
      days: snapshot.days,
      totalWeeks: snapshot.totalWeeks,
      totalKm: snapshot.totalKm,
      peakWeekKm: snapshot.peakWeekKm,
    })
    setStatus("complete")
    totalWeeksRef.current = snapshot.totalWeeks

    void savePlanToServer(snapshot.input, snapshot.days, snapshot.totalWeeks, snapshot.totalKm, snapshot.peakWeekKm)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.session?.id])

  // ── Streaming ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) { router.replace("/"); return }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      router.replace("/")
      return
    }

    const mapped = mapToInput(parsed)
    if (!mapped) { router.replace("/"); return }
    setInput(mapped)

    // Prevent double-execution when sessionPending changes
    if (streamStartedRef.current) return

    // If athlos_plan exists in sessionStorage, we may be returning from OAuth.
    // Wait until session state is resolved before deciding.
    if (sessionStorage.getItem(PLAN_KEY)) {
      if (sessionPending) return // wait — re-effect runs when sessionPending changes
      if (sessionData?.session) return // session confirmed, auto-save effect handles it
      // Session resolved to null (e.g., magic link opened in different browser).
      // Clear stale PLAN_KEY and fall through to stream normally.
      sessionStorage.removeItem(PLAN_KEY)
    }

    streamStartedRef.current = true

    async function stream() {
      let response: Response
      try {
        response = await fetch("/api/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mapped),
        })
      } catch {
        setStatus("error")
        return
      }

      if (!response.ok || !response.body) {
        setStatus("error")
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        let done: boolean
        let value: Uint8Array | undefined
        try {
          ;({ done, value } = await reader.read())
        } catch {
          setStatus("error")
          return
        }

        if (done) {
          if (totalWeeksRef.current === 0 || dayCountRef.current === 0) {
            setStatus("error")
          } else {
            setStatus("complete")
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line) as Record<string, unknown>

            if ("error" in parsed) {
              setStatus("error")
              break
            } else if (parsed["_meta"] === true) {
              const tw = Number(parsed["totalWeeks"] ?? 0)
              totalWeeksRef.current = tw
              setPlan((p) => ({
                ...p,
                totalWeeks: tw,
                totalKm: Number(parsed["totalKm"] ?? 0),
                peakWeekKm: Number(parsed["peakWeekKm"] ?? 0),
              }))
            } else {
              const day = parsed as unknown as WorkoutDay
              dayCountRef.current += 1
              if (!startDateRef.current) startDateRef.current = day.date
              const weekNum =
                Math.floor(
                  (new Date(day.date).getTime() - new Date(startDateRef.current).getTime()) /
                    (7 * 24 * 60 * 60 * 1000)
                ) + 1
              setGeneratingWeek(weekNum)
              setPlan((p) => {
                const existing = p.days ?? []
                const idx = existing.findIndex((d) => d.date === day.date && d.type === day.type)
                const days = idx >= 0
                  ? existing.map((d, i) => (i === idx ? day : d))
                  : [...existing, day]
                return { ...p, days }
              })
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    }

    void stream()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPending]) // re-run when session loading state resolves

  // ── Save helpers ──────────────────────────────────────────────────────────

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

  function handleBeforeSignIn() {
    const current = planRef.current
    if (!input) return
    const snapshot: SavedPlanSnapshot = {
      input,
      days: current.days ?? [],
      totalWeeks: current.totalWeeks ?? 0,
      totalKm: current.totalKm ?? 0,
      peakWeekKm: current.peakWeekKm ?? 0,
    }
    sessionStorage.setItem(PLAN_KEY, JSON.stringify(snapshot))
  }

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

  // ── Render ────────────────────────────────────────────────────────────────

  if (!input) return null  // redirecting

  const saveProps = { status, isSaving, saveError, onSave: handleSave }

  return (
    <main className="min-h-svh flex flex-col">
      <PlanHeader
        planName={planName(input)}
        totalWeeks={plan.totalWeeks ?? 0}
        totalKm={plan.totalKm ?? 0}
        units={input.units}
        status={status}
        generatingWeek={generatingWeek}
        goalTimeLabel={goalTimeLabel(input)}
        saveProps={saveProps}
      />

      {/* Desktop: calendar */}
      <div className="hidden md:block flex-1">
        <PlanCalendar
          days={plan.days ?? []}
          units={input.units}
          totalWeeks={plan.totalWeeks ?? 0}
          raceDistance={input.race?.distance}
          selectedKey={selectedKey}
          onSelectedKeyChange={setSelectedKey}
        />
      </div>

      {/* Mobile: feed */}
      <div className="md:hidden flex-1 overflow-y-auto pt-2">
        <PlanFeed
          days={plan.days ?? []}
          units={input.units}
          totalWeeks={plan.totalWeeks ?? 0}
          raceDistance={input.race?.distance}
          selectedKey={selectedKey}
          onSelectedKeyChange={setSelectedKey}
        />
      </div>

      {showSignInSheet && (
        <SignInSheet
          onBeforeSignIn={handleBeforeSignIn}
          onClose={() => setShowSignInSheet(false)}
        />
      )}
    </main>
  )
}
