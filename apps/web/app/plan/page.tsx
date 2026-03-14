"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { PlanGenerationInput, TrainingPlan, WorkoutDay } from "@workspace/ai"
import { PlanHeader } from "./plan-header"
import { PlanCalendar } from "./plan-calendar"
import { PlanFeed } from "./plan-feed"

const SESSION_KEY = "athloryx_onboarding"

function mapToInput(raw: Record<string, unknown>): PlanGenerationInput | null {
  const goal = raw["goal"] as string | undefined
  const selectedDays = raw["selectedDays"] as string[] | undefined
  const longRunDay = raw["longRunDay"] as string | undefined
  const units = raw["units"] as "km" | "miles" | undefined

  if (!goal || !selectedDays?.length || !longRunDay || !units) return null
  if (goal !== "race" && goal !== "aerobic_base") return null

  const input: PlanGenerationInput = {
    goal,
    selectedDays,
    longRunDay,
    units,
    strengthTraining: Boolean(raw["strengthTraining"]),
    strengthDays: raw["strengthDays"] as string[] | undefined,
  }

  if (goal === "race" && raw["race"]) {
    const race = raw["race"] as Record<string, unknown>
    input.race = {
      name: String(race["name"] ?? ""),
      date: String(race["date"] ?? ""),
      distance: race["distance"] as "5k" | "10k" | "half" | "full" | "ultra",
      city: String(race["city"] ?? ""),
    }
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
  const [plan, setPlan] = useState<Partial<TrainingPlan>>({ days: [] })
  const [status, setStatus] = useState<"generating" | "complete" | "error">("generating")
  const [generatingWeek, setGeneratingWeek] = useState(1)
  const [input, setInput] = useState<PlanGenerationInput | null>(null)

  // Refs to avoid stale closures inside the async stream loop
  const totalWeeksRef = useRef(0)
  const dayCountRef = useRef(0)
  const startDateRef = useRef<string | null>(null)

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
          if (totalWeeksRef.current === 0 || dayCountRef.current < totalWeeksRef.current * 7) {
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

            if (parsed["_meta"] === true) {
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
              setPlan((p) => ({ ...p, days: [...(p.days ?? []), day] }))
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    }

    void stream()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!input) return null  // redirecting

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
      />

      {/* Desktop: calendar */}
      <div className="hidden md:block flex-1">
        <PlanCalendar
          days={plan.days ?? []}
          units={input.units}
          totalWeeks={plan.totalWeeks ?? 0}
          raceDistance={input.race?.distance}
        />
      </div>

      {/* Mobile: feed */}
      <div className="md:hidden flex-1 overflow-y-auto pt-2">
        <PlanFeed
          days={plan.days ?? []}
          units={input.units}
          totalWeeks={plan.totalWeeks ?? 0}
          raceDistance={input.race?.distance}
        />
      </div>
    </main>
  )
}
