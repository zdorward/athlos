"use client"

import { differenceInWeeks, format } from "date-fns"
import { Calendar, Dumbbell, Timer } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { type Distance, type OnboardingData, DAY_LABELS, ORDERED_DAYS } from "./types"
import { cn } from "@workspace/ui/lib/utils"

const SESSION_KEY = "athlos_onboarding"
const DRAFT_KEY = "athlos_onboarding_draft"

const DISTANCE_KM: Record<Distance, string> = {
  "5k":   "5 km",
  "10k":  "10 km",
  "half": "21.1 km",
  "full": "42.2 km",
  "ultra": "Ultra",
}

interface FinalScreenProps {
  formData: OnboardingData
}

function DayChips({ days, longRunDay }: { days: string[]; longRunDay?: string }) {
  return (
    <div className="flex gap-1.5">
      {ORDERED_DAYS.map((day) => {
        const active = days.includes(day)
        const isLongRun = day === longRunDay
        if (!active) return null
        return (
          <span
            key={day}
            className={cn(
              "text-xs font-medium px-2 py-1 rounded-md leading-none",
              isLongRun
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-muted text-muted-foreground border border-transparent"
            )}
          >
            {DAY_LABELS[day].short}
          </span>
        )
      })}
    </div>
  )
}

export function FinalScreen({ formData }: FinalScreenProps) {
  const router = useRouter()
  const { race, goal, selectedDays, longRunDay, goalTime, strengthDays } = formData

  function handleGenerate() {
    // Normalize race.date (Date object) to ISO "YYYY-MM-DD" before JSON.stringify
    const serializable = {
      ...formData,
      race: race ? { ...race, date: race.date.toLocaleDateString("en-CA") } : undefined,
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(serializable))
    sessionStorage.removeItem(DRAFT_KEY)
    router.push("/plan")
  }

  const isRace = goal === "race" && race
  const distanceLabel = isRace ? DISTANCE_KM[race.distance] : null
  const weeks = isRace ? Math.max(0, differenceInWeeks(race.date, new Date())) : null
  const tooSoon = weeks !== null && weeks < 2
  const goalTimeLabel = goalTime
    ? `${goalTime.hours}:${goalTime.minutes.toString().padStart(2, "0")}`
    : null

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {isRace ? `Ready to build your ${race.name} plan` : "Ready to build your plan"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isRace ? `${weeks} weeks to race day.` : "Here's what we'll build."}
        </p>
      </div>

      {isRace && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Timer className="h-4 w-4 shrink-0" />
            <span>{distanceLabel}{goalTimeLabel ? ` · Goal ${goalTimeLabel}` : ""}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>{format(race.date, "EEE, MMM d, yyyy")}</span>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-4">
        {selectedDays && selectedDays.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Running days</span>
            <DayChips days={selectedDays} longRunDay={longRunDay} />
          </div>
        )}
        {strengthDays && strengthDays.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Dumbbell className="h-3 w-3" /> Lifting days
            </span>
            <DayChips days={strengthDays} />
          </div>
        )}
      </div>

      {tooSoon && (
        <p className="text-sm text-destructive text-center">
          Your race is less than 2 weeks away — not enough time for a meaningful plan.
        </p>
      )}
      <Button className="w-full" size="lg" onClick={handleGenerate} disabled={!!tooSoon}>
        Build My Plan
      </Button>
    </div>
  )
}
