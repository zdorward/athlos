"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

type MileageRange = "under-40" | "40-60" | "60-80" | "80-plus"

const OPTIONS: { value: MileageRange; label: string; description: string }[] = [
  { value: "under-40", label: "Under 40 km/week",  description: "Building base fitness" },
  { value: "40-60",   label: "40–60 km/week",      description: "Solid recreational runner" },
  { value: "60-80",   label: "60–80 km/week",      description: "Committed club runner" },
  { value: "80-plus", label: "80+ km/week",         description: "High mileage athlete" },
]

export function StepWeeklyMileage({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<MileageRange | undefined>(formData.weeklyMileageRange)

  function handleSelect(value: MileageRange) {
    setSelected(value)
    setTimeout(() => onNext({ weeklyMileageRange: value }), 150)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          How many kilometres do you run per week?
        </h2>
        <p className="text-sm text-muted-foreground">
          This sets your starting volume for week 1 of the plan.
        </p>
      </div>
      <div className="space-y-3">
        {OPTIONS.map((opt) => (
          <OnboardingCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            selected={selected === opt.value}
            onClick={() => handleSelect(opt.value)}
          />
        ))}
      </div>
    </div>
  )
}
