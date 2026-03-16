// apps/web/components/onboarding/steps/step-strength.tsx
"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { DayToggle } from "../day-toggle"
import { ORDERED_DAYS, DAY_LABELS, type Day, type StepProps } from "../types"
import {
  recommendStrengthCount,
  recommendStrengthDays,
  computeGoalPeakMileage,
} from "@workspace/ai"

export function StepStrength({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const longRunDay = formData.longRunDay ?? "sun"
  const weeklyMileageRange = formData.weeklyMileageRange ?? "40-60"

  // Derive peakMileageHigh from goal time + race distance
  const goalMinutes = formData.goalTime
    ? formData.goalTime.hours * 60 + formData.goalTime.minutes
    : null
  const peakMileageHigh =
    goalMinutes !== null && formData.race?.distance
      ? (computeGoalPeakMileage(formData.race.distance, goalMinutes)?.high ?? null)
      : null

  const recommendedCount = recommendStrengthCount(peakMileageHigh, weeklyMileageRange)
  const defaultDays = recommendStrengthDays(longRunDay, recommendedCount)

  // Use restored draft days if present (including empty array from a prior skip),
  // otherwise fall back to the Pfitzinger-recommended defaults.
  const [selected, setSelected] = useState<Day[]>(
    formData.strengthDays !== undefined ? formData.strengthDays : defaultDays
  )

  function toggle(day: Day) {
    setSelected((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const bannerText =
    recommendedCount === 1
      ? "Your goal implies a high-volume peak — we suggest 1 lifting day to protect recovery. This stops in Taper."
      : "Based on your goal and training volume, we suggest 2 lifting days during Base and Build. This drops to 1 in Peak and stops in Taper."

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Strength training</h2>
        <p className="text-sm text-muted-foreground">{bannerText}</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Lifting days</p>
        <div className="flex w-full justify-center gap-2">
          {ORDERED_DAYS.map((day) => (
            <DayToggle
              key={day}
              day={day}
              label={DAY_LABELS[day].short}
              selected={selected.includes(day)}
              onClick={() => toggle(day)}
            />
          ))}
        </div>
        {selected.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Select at least one day, or skip strength training below.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <Button
          onClick={() => onNext({ strengthTraining: true, strengthDays: selected })}
          disabled={selected.length === 0}
          className="w-full"
        >
          Continue
        </Button>
        <button
          onClick={() => onNext({ strengthTraining: false, strengthDays: [] })}
          className="w-full cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          Skip strength training →
        </button>
      </div>
    </div>
  )
}
