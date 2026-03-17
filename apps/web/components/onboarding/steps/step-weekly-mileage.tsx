"use client"

import { useState } from "react"
import { computeGoalPeakMileage } from "@workspace/plan-engine"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

type MileageRange = "under-40" | "40-60" | "60-80" | "80-plus"

const KM_OPTIONS: { value: MileageRange; label: string; description: string }[] = [
  { value: "under-40", label: "Under 40 km/week",  description: "Building base fitness" },
  { value: "40-60",   label: "40–60 km/week",      description: "Consistent recreational runner" },
  { value: "60-80",   label: "60–80 km/week",      description: "Consistent club runner" },
  { value: "80-plus", label: "80+ km/week",         description: "High mileage athlete" },
]

const MILES_OPTIONS: { value: MileageRange; label: string; description: string }[] = [
  { value: "under-40", label: "Under 25 mi/week",  description: "Building base fitness" },
  { value: "40-60",   label: "25–37 mi/week",      description: "Consistent recreational runner" },
  { value: "60-80",   label: "37–50 mi/week",      description: "Consistent club runner" },
  { value: "80-plus", label: "50+ mi/week",         description: "High mileage athlete" },
]

// Always in km — matches WEEK1_VOLUME_KM in volume-progression.ts
const MILEAGE_RANGE_LOW_KM: Record<MileageRange, number> = {
  "under-40": 30,
  "40-60":    40,
  "60-80":    60,
  "80-plus":  80,
}

function computeWarning(
  range: MileageRange,
  formData: StepProps["formData"],
): { peakKm: number; multiplier: number } | null {
  if (!formData.goalTime || !formData.race?.distance) return null
  const goalTotalMinutes = formData.goalTime.hours * 60 + formData.goalTime.minutes
  const result = computeGoalPeakMileage(formData.race.distance, goalTotalMinutes)
  if (!result) return null
  const startingVol = MILEAGE_RANGE_LOW_KM[range]
  const peakKm = result.high
  if (peakKm <= startingVol * 1.5) return null
  const multiplier = Math.round((peakKm / startingVol) * 10) / 10
  return { peakKm: Math.round(peakKm), multiplier }
}

export function StepWeeklyMileage({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<MileageRange | undefined>(formData.weeklyMileageRange)
  const [warning, setWarning] = useState<{ peakKm: number; multiplier: number } | null>(() =>
    formData.weeklyMileageRange ? computeWarning(formData.weeklyMileageRange, formData) : null
  )
  const units = formData.units ?? "km"
  const options = units === "miles" ? MILES_OPTIONS : KM_OPTIONS

  function handleSelect(value: MileageRange) {
    setSelected(value)
    const w = computeWarning(value, formData)
    setWarning(w)
    if (!w) {
      setTimeout(() => onNext({ weeklyMileageRange: value }), 150)
    }
    // If warning: stay on page, show warning + Continue button
  }

  function handleContinue() {
    if (selected) onNext({ weeklyMileageRange: selected })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {units === "miles"
            ? "How many miles do you run per week?"
            : "How many kilometres do you run per week?"}
        </h2>
        <p className="text-sm text-muted-foreground">
          This sets your starting volume for week 1 of the plan.
        </p>
      </div>
      <div className="space-y-3">
        {options.map((opt) => (
          <OnboardingCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            selected={selected === opt.value}
            onClick={() => handleSelect(opt.value)}
          />
        ))}
      </div>
      {warning && selected && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-4 space-y-3">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Your goal time implies peak training weeks of ~{warning.peakKm} km — about {warning.multiplier}× your current volume. Your plan will ramp gradually, but this is an ambitious build. Consider extending your plan start date for more ramp time.
          </p>
          <button
            onClick={handleContinue}
            className="text-sm font-medium text-amber-900 dark:text-amber-200 underline underline-offset-2"
          >
            Continue anyway
          </button>
        </div>
      )}
    </div>
  )
}
