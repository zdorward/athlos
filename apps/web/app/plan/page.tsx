"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { PlanGenerationInput, TrainingPlan, WorkoutDay, WorkoutType, PhaseEntry } from "@workspace/plan-engine"
import { authClient } from "@/lib/auth-client"
import { PlanHeader } from "./plan-header"
import { PlanCalendar } from "./plan-calendar"
import { PlanFeed } from "./plan-feed"
import { SignInSheet } from "./sign-in-sheet"
import { formatGoalTime } from "./workout-utils"

const SESSION_KEY = "athlos_onboarding"
const PLAN_KEY = "athlos_plan"
const PLAN_SAVED_KEY = "athlos_plan_saved"

interface SavedPlanSnapshot {
  input: PlanGenerationInput
  days: WorkoutDay[]
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  phases?: PhaseEntry[]
  planStartDate?: string  // optional for backward compat with snapshots saved before this change
  savedAt: number
}

function mapToInput(raw: Record<string, unknown>): PlanGenerationInput | null {
  const goal = raw["goal"] as string | undefined
  const selectedDays = raw["selectedDays"] as string[] | undefined
  const longRunDay = raw["longRunDay"] as string | undefined

  if (!goal || !selectedDays?.length || !longRunDay) return null
  if (goal !== "race" || !raw["race"]) return null

  const race = raw["race"] as Record<string, unknown>
  const input: PlanGenerationInput = {
    goal: "race",
    race: {
      name: String(race["name"] ?? ""),
      date: String(race["date"] ?? ""),
      distance: race["distance"] as "half" | "full",
      city: String(race["city"] ?? ""),
    },
    selectedDays,
    longRunDay,
    // To add a units setting: add a "units" step to onboarding and store the value in
    // sessionStorage under SESSION_KEY. This line will pick it up automatically.
    units: (raw["units"] === "miles" ? "miles" : "km") as "km" | "miles",
    weeklyMileageRange: "40-60",  // default; overwritten below
  }

  if (raw["timeGoal"] === true && raw["goalTime"]) {
    const gt = raw["goalTime"] as Record<string, unknown>
    input.goalTime = {
      hours: Number(gt["hours"] ?? 0),
      minutes: Number(gt["minutes"] ?? 0),
      seconds: Number(gt["seconds"] ?? 0),
    }
  }

  // weeklyMileageRange — apply default if missing
  const rawRange = raw["weeklyMileageRange"] as string | undefined
  const validRanges = ["under-40", "40-60", "60-80", "80-plus"]
  input.weeklyMileageRange = validRanges.includes(rawRange ?? "")
    ? (rawRange as PlanGenerationInput["weeklyMileageRange"])
    : "40-60"

  return input
}


function planName(input: PlanGenerationInput): string {
  if (input.goal === "race" && input.race) return input.race.name
  return "Aerobic Base Plan"
}

export default function PlanPage() {
  const router = useRouter()
  const { data: sessionData, isPending: sessionPending } = authClient.useSession()

  const [plan, setPlan] = useState<Partial<TrainingPlan>>({ days: [] })
  const [status, setStatus] = useState<"generating" | "complete" | "error" | "rate-limited">("generating")
  const [isNewlyGenerated, setIsNewlyGenerated] = useState(false)
  const [input, setInput] = useState<PlanGenerationInput | null>(null)

  const [phases, setPhases] = useState<PhaseEntry[]>([])
  const [planStartDate, setPlanStartDate] = useState<string | null>(null)

  const [selectedKey, setSelectedKey] = useState<{ date: string; type: WorkoutType } | null>(null)

  // Save state
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [showSignInSheet, setShowSignInSheet] = useState(false)
  const [planSaved, setPlanSaved] = useState(false)

  // Refs
  const totalWeeksRef = useRef(0)
  const planRef = useRef<Partial<TrainingPlan>>({ days: [] })
  const generationStartedRef = useRef(false)

  // Keep planRef in sync with plan state for use in callbacks
  useEffect(() => { planRef.current = plan }, [plan])

  // ── Cross-tab plan-saved detection ────────────────────────────────────────
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== PLAN_SAVED_KEY) return
      localStorage.removeItem(PLAN_SAVED_KEY)
      setShowSignInSheet(false)
      setPlanSaved(true)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  // ── Auto-save after OAuth/magic-link redirect ─────────────────────────────
  useEffect(() => {
    if (!sessionData?.session) return
    const raw = localStorage.getItem(PLAN_KEY)
    if (!raw) return

    // Guard: don't restore a stale snapshot if a stream is already in progress
    if (totalWeeksRef.current > 0) {
      localStorage.removeItem(PLAN_KEY)
      return
    }

    // Discard snapshots older than 10 minutes (stale from a prior session)
    const TEN_MINUTES = 10 * 60 * 1000
    let snapshot: SavedPlanSnapshot
    try {
      snapshot = JSON.parse(raw) as SavedPlanSnapshot
    } catch {
      localStorage.removeItem(PLAN_KEY)
      return
    }
    if (!snapshot.savedAt || Date.now() - snapshot.savedAt > TEN_MINUTES) {
      localStorage.removeItem(PLAN_KEY)
      return
    }

    localStorage.removeItem(PLAN_KEY)

    // Restore plan state from snapshot and trigger save.
    // Mark stream as started so the streaming effect doesn't fire a new generation.
    generationStartedRef.current = true
    setInput(snapshot.input)
    setPhases(snapshot.phases ?? [])
    const restoredPlanStartDate = snapshot.planStartDate
      ?? snapshot.days.find(d => new Date(d.date + "T00:00:00Z").getUTCDay() === 1)?.date
      ?? null
    setPlanStartDate(restoredPlanStartDate)
    setPlan({
      days:       snapshot.days,
      totalWeeks: snapshot.totalWeeks,
      totalKm:    snapshot.totalKm,
      peakWeekKm: snapshot.peakWeekKm,
      phases:     snapshot.phases ?? [],
    })
    setStatus("complete")
    totalWeeksRef.current = snapshot.totalWeeks

    // Note: phases are not persisted server-side yet (SavePlanBody has no phases field).
    // When the DB schema and API are updated to store phases, pass snapshot.phases here.
    savePlanToServer(snapshot.input, snapshot.days, snapshot.totalWeeks, snapshot.totalKm, snapshot.peakWeekKm)
      .then((saved) => {
        if (saved) {
          localStorage.setItem(PLAN_SAVED_KEY, String(Date.now()))
          router.push("/dashboard")
        }
      })
      .catch(() => { /* setSaveError already called inside savePlanToServer */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.session?.id])

  // ── Plan generation ───────────────────────────────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) {
      const planRaw = localStorage.getItem(PLAN_KEY)
      if (planRaw) {
        try {
          const snap = JSON.parse(planRaw) as SavedPlanSnapshot
          const TEN_MINUTES = 10 * 60 * 1000
          if (snap.savedAt && Date.now() - snap.savedAt <= TEN_MINUTES) {
            generationStartedRef.current = true
            setInput(snap.input)
            return
          }
        } catch {}
        localStorage.removeItem(PLAN_KEY)
      }
      router.replace("/")
      return
    }

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

    if (generationStartedRef.current) return

    if (localStorage.getItem(PLAN_KEY)) {
      if (sessionPending) return
      if (sessionData?.session) return
      localStorage.removeItem(PLAN_KEY)
    }

    generationStartedRef.current = true
    setIsNewlyGenerated(true)

    let cancelled = false

    async function generate() {
      let response: Response
      try {
        response = await fetch("/api/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...mapped, today: new Date().toLocaleDateString("en-CA") }),
        })
      } catch {
        if (!cancelled) setStatus("error")
        return
      }

      if (!response.ok) {
        if (!cancelled) setStatus("error")
        return
      }

      let result: { days: WorkoutDay[]; totalWeeks: number; totalKm: number; peakWeekKm: number; phases: PhaseEntry[]; planStartDate: string }
      try {
        result = await response.json()
      } catch {
        if (!cancelled) setStatus("error")
        return
      }

      if (cancelled) return

      totalWeeksRef.current = result.totalWeeks
      setPhases(result.phases ?? [])
      setPlanStartDate(result.planStartDate)
      setPlan({
        days: result.days,
        totalWeeks: result.totalWeeks,
        totalKm: result.totalKm,
        peakWeekKm: result.peakWeekKm,
        phases: result.phases,
      })
      setStatus("complete")
    }

    void generate()
    return () => {
      cancelled = true
      generationStartedRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPending])

  // ── Save helpers ──────────────────────────────────────────────────────────

  async function savePlanToServer(
    planInput: PlanGenerationInput,
    days: WorkoutDay[],
    totalWeeks: number,
    totalKm: number,
    peakWeekKm: number,
  ): Promise<boolean> {
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
        return false
      }
      if (!res.ok) throw new Error("Save failed")
      // Sync units preference to DB so all pages reflect the correct unit on session read
      await authClient.updateUser({ units: planInput.units })
      return true
    } catch {
      setSaveError(true)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  function handleBeforeSignIn() {
    const current = planRef.current
    if (!input) return
    const snapshot: SavedPlanSnapshot = {
      input,
      days:           current.days       ?? [],
      totalWeeks:     current.totalWeeks ?? 0,
      totalKm:        current.totalKm    ?? 0,
      peakWeekKm:     current.peakWeekKm ?? 0,
      phases:         current.phases     ?? [],
      planStartDate:  planStartDate ?? undefined,
      savedAt:        Date.now(),
    }
    localStorage.setItem(PLAN_KEY, JSON.stringify(snapshot))
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
    ).then((saved) => {
      if (saved) {
        setIsNewlyGenerated(false)
        router.push("/dashboard")
      }
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!input) return null  // redirecting

  const saveProps = { status, isSaving, saveError, onSave: handleSave, saved: planSaved }

  return (
    <main className="min-h-svh flex flex-col">
      <PlanHeader
        planName={planName(input)}
        totalWeeks={plan.totalWeeks ?? 0}
        totalKm={plan.totalKm ?? 0}
        units={input.units}
        status={status}
        goalTimeLabel={formatGoalTime(input)}
        saveProps={saveProps}
      />

      {/* Desktop: calendar */}
      <div className="hidden md:block flex-1">
        <PlanCalendar
          days={plan.days ?? []}
          units={input.units}
          totalWeeks={plan.totalWeeks ?? 0}
          raceDistance={input.race?.distance as "half" | "full" | undefined}
          phases={phases}
          planStartDate={planStartDate ?? undefined}
          selectedKey={selectedKey}
          onSelectedKeyChange={setSelectedKey}
          isNewlyGenerated={isNewlyGenerated}
        />
      </div>

      {/* Mobile: feed */}
      <div className="md:hidden flex-1 overflow-y-auto pt-2">
        <PlanFeed
          days={plan.days ?? []}
          units={input.units}
          totalWeeks={plan.totalWeeks ?? 0}
          raceDistance={input.race?.distance as "half" | "full" | undefined}
          phases={phases}
          planStartDate={planStartDate ?? undefined}
          selectedKey={selectedKey}
          onSelectedKeyChange={setSelectedKey}
          isNewlyGenerated={isNewlyGenerated}
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
