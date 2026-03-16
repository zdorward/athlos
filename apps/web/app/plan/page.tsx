"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { buildBridgeRuns, peakStrengthDay, firstMondayOnOrAfter } from "@workspace/ai"
import type { PlanGenerationInput, TrainingPlan, WorkoutDay, WorkoutType, PhaseEntry } from "@workspace/ai"
import { authClient } from "@/lib/auth-client"
import { PlanHeader } from "./plan-header"
import { PlanCalendar } from "./plan-calendar"
import { PlanFeed } from "./plan-feed"
import { SignInSheet } from "./sign-in-sheet"

const SESSION_KEY = "athlos_onboarding"
const PLAN_KEY = "athlos_plan"
const PLAN_SAVED_KEY = "athlos_plan_saved"

const VALID_WORKOUT_TYPES = new Set([
  "easy", "long", "medium-long", "mp", "tempo", "intervals", "rest", "race", "strength",
])

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const

function mergeStrengthDays(
  days: WorkoutDay[],
  strengthDays: string[],
  longRunDay: string,
  startDate: Date,
  endDate: Date,
  phases: PhaseEntry[] | undefined,
): WorkoutDay[] {
  if (strengthDays.length === 0) return days

  const msPerWeek = 7 * 24 * 60 * 60 * 1000

  function activeDaysForWeek(weekNum: number): Set<string> {
    const phase = phases?.find(p => weekNum >= p.startWeek && weekNum <= p.endWeek)
    const name = phase?.name?.toLowerCase() ?? ""
    if (name === "taper") return new Set()
    if (name === "peak") {
      const best = peakStrengthDay(strengthDays, longRunDay)
      return best ? new Set([best]) : new Set()
    }
    // General Fitness, Base, Build, or no phases available: all days
    return new Set(strengthDays)
  }

  const result = [...days]
  const d = new Date(startDate.getTime())
  while (d <= endDate) {
    const weekNum = Math.floor((d.getTime() - startDate.getTime()) / msPerWeek) + 1
    const key = DAY_KEYS[d.getDay()]
    if (key && activeDaysForWeek(weekNum).has(key)) {
      const dateStr = d.toLocaleDateString("en-CA")
      if (!result.some((e) => e.date === dateStr && e.type === "strength")) {
        result.push({ date: dateStr, type: "strength", description: "Strength training" })
      }
    }
    d.setDate(d.getDate() + 1)
  }
  return result
}

interface SavedPlanSnapshot {
  input: PlanGenerationInput
  days: WorkoutDay[]
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  phases?: PhaseEntry[]  // optional for backward compatibility with snapshots saved before this change
  savedAt: number  // Date.now() timestamp for staleness check
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
      distance: race["distance"] as "half" | "full",
      city: String(race["city"] ?? ""),
    },
    selectedDays,
    longRunDay,
    // To add a units setting: add a "units" step to onboarding and store the value in
    // sessionStorage under SESSION_KEY. This line will pick it up automatically.
    units: (raw["units"] === "miles" ? "miles" : "km") as "km" | "miles",
    strengthTraining: Array.isArray(strengthDays) && strengthDays.length > 0,
    strengthDays,
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

  const rawTrainingAge = raw["trainingAge"] as string | undefined
  const validTrainingAges = ["under-1", "1-3", "3-or-more"]
  if (rawTrainingAge && validTrainingAges.includes(rawTrainingAge)) {
    input.trainingAge = rawTrainingAge as PlanGenerationInput["trainingAge"]
  }

  return input
}

function goalTimeLabel(input: PlanGenerationInput): string | undefined {
  if (!input.goalTime) return undefined
  const { hours, minutes, seconds } = input.goalTime
  const base = `${hours}:${minutes.toString().padStart(2, "0")}`
  return (seconds ?? 0) > 0 ? `${base}:${seconds!.toString().padStart(2, "0")}` : base
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

  const [phases, setPhases] = useState<PhaseEntry[]>([])

  const [selectedKey, setSelectedKey] = useState<{ date: string; type: WorkoutType } | null>(null)

  // Save state
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [showSignInSheet, setShowSignInSheet] = useState(false)
  const [planSaved, setPlanSaved] = useState(false)

  // Refs to avoid stale closures inside the async stream loop
  const totalWeeksRef = useRef(0)
  const dayCountRef = useRef(0)
  const startDateRef = useRef<string | null>(null)
  const planRef = useRef<Partial<TrainingPlan>>({ days: [] })
  const streamStartedRef = useRef(false)

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
    streamStartedRef.current = true
    setInput(snapshot.input)
    setPhases(snapshot.phases ?? [])
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

  // ── Streaming ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) {
      // No onboarding data in this tab. Check if we're returning from a magic
      // link click (which opens in a new tab, so sessionStorage is empty).
      // If a fresh plan snapshot exists in localStorage, don't redirect —
      // the auto-save effect will handle saving once the session resolves.
      const planRaw = localStorage.getItem(PLAN_KEY)
      if (planRaw) {
        try {
          const snap = JSON.parse(planRaw) as SavedPlanSnapshot
          const TEN_MINUTES = 10 * 60 * 1000
          if (snap.savedAt && Date.now() - snap.savedAt <= TEN_MINUTES) {
            streamStartedRef.current = true
            setInput(snap.input) // render the plan while auto-save fires
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
    const planInput: PlanGenerationInput = mapped
    setInput(mapped)

    // Prevent double-execution when sessionPending changes
    if (streamStartedRef.current) return

    // If athlos_plan exists in localStorage, we may be returning from OAuth.
    // Wait until session state is resolved before deciding.
    if (localStorage.getItem(PLAN_KEY)) {
      if (sessionPending) return // wait — re-effect runs when sessionPending changes
      if (sessionData?.session) return // session confirmed, auto-save effect handles it
      // Session resolved to null — clear stale snapshot and stream normally.
      localStorage.removeItem(PLAN_KEY)
    }

    streamStartedRef.current = true

    async function stream() {
      let response: Response
      try {
        response = await fetch("/api/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(planInput),
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
      const localDays: WorkoutDay[] = []
      let localPhases: PhaseEntry[] = []

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
            const bridgeDays = buildBridgeRuns(planInput, localDays, new Date())
            let finalDays: WorkoutDay[] = bridgeDays.length > 0
              ? [...bridgeDays, ...localDays].sort((a, b) => a.date.localeCompare(b.date))
              : localDays

            // Inject strength days — LLM no longer outputs them
            if (planInput.strengthDays?.length && localDays.length > 0) {
              finalDays = mergeStrengthDays(
                finalDays,
                planInput.strengthDays,
                planInput.longRunDay,
                new Date(localDays[0]!.date + "T00:00:00"),
                new Date(localDays[localDays.length - 1]!.date + "T00:00:00"),
                localPhases,
              )
            }

            const newTotalKm = finalDays.reduce((sum, d) => sum + (d.distanceKm ?? 0), 0)
            setPlan((p) => ({ ...p, days: finalDays, totalKm: newTotalKm }))
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
              const metaPhases = Array.isArray(parsed["phases"])
                ? (parsed["phases"] as PhaseEntry[])
                : []
              setPhases(metaPhases)
              localPhases = metaPhases
              // Pre-populate strength days immediately so they appear during streaming
              if (planInput.strengthDays?.length) {
                const planStart = planInput.startDate
                  ? new Date(planInput.startDate + "T00:00:00Z")
                  : firstMondayOnOrAfter(new Date())
                const planEnd = new Date(planInput.race.date + "T00:00:00Z")
                const earlyStrengthDays = mergeStrengthDays(
                  [],
                  planInput.strengthDays,
                  planInput.longRunDay,
                  planStart,
                  planEnd,
                  metaPhases,
                )
                if (earlyStrengthDays.length > 0) {
                  setPlan((p) => ({ ...p, days: [...(p.days ?? []), ...earlyStrengthDays] }))
                }
              }
              setPlan((p) => ({
                ...p,
                totalWeeks: tw,
                totalKm:    Number(parsed["totalKm"]    ?? 0),
                peakWeekKm: Number(parsed["peakWeekKm"] ?? 0),
                phases:     metaPhases,
              }))
            } else {
              const day = parsed as unknown as WorkoutDay
              if (typeof day.date !== "string" || !VALID_WORKOUT_TYPES.has(day.type)) continue
              const localIdx = localDays.findIndex((d) => d.date === day.date && d.type === day.type)
              if (localIdx >= 0) { localDays[localIdx] = day } else { localDays.push(day) }
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
      days:       current.days       ?? [],
      totalWeeks: current.totalWeeks ?? 0,
      totalKm:    current.totalKm    ?? 0,
      peakWeekKm: current.peakWeekKm ?? 0,
      phases:     current.phases     ?? [],
      savedAt:    Date.now(),
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
      if (saved) router.push("/dashboard")
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
          raceDistance={input.race?.distance as "half" | "full" | undefined}
          phases={phases}
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
          raceDistance={input.race?.distance as "half" | "full" | undefined}
          phases={phases}
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
