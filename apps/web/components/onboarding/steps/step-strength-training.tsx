"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

export function StepStrengthTraining({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<boolean | undefined>(formData.strengthTraining)

  function handleSelect(value: boolean) {
    setSelected(value)
    setTimeout(() => onNext({ strengthTraining: value }), 150)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Would you like to include strength training?
        </h2>
        <p className="text-sm text-muted-foreground">
          We&apos;ll work strength sessions around your key runs.
        </p>
      </div>
      <div className="space-y-3">
        <OnboardingCard
          label="Yes"
          description="Strength sessions scheduled around your runs"
          selected={selected === true}
          onClick={() => handleSelect(true)}
        />
        <OnboardingCard
          label="No"
          description="Your plan will focus on running only"
          selected={selected === false}
          onClick={() => handleSelect(false)}
        />
      </div>
    </div>
  )
}
