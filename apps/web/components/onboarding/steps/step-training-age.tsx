"use client"

import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

type TrainingAge = "under-1" | "1-3" | "3-or-more"

const OPTIONS: { value: TrainingAge; label: string; description: string }[] = [
  { value: "under-1",    label: "Less than a year",  description: "Conservative buildup, aerobic base focus" },
  { value: "1-3",        label: "1–3 years",          description: "Standard training progression" },
  { value: "3-or-more",  label: "3 or more years",    description: "Faster buildup, more quality sessions" },
]

export function StepTrainingAge({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  function handleSelect(value: TrainingAge) {
    setTimeout(() => onNext({ trainingAge: value }), 150)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          How long have you been running consistently?
        </h2>
        <p className="text-sm text-muted-foreground">
          This shapes how aggressively we build your mileage and workouts.
        </p>
      </div>
      <div className="space-y-3">
        {OPTIONS.map((opt) => (
          <OnboardingCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            selected={formData.trainingAge === opt.value}
            onClick={() => handleSelect(opt.value)}
          />
        ))}
      </div>
    </div>
  )
}
