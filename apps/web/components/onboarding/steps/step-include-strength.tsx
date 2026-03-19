"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

export function StepIncludeStrength({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<boolean | undefined>(formData.includeStrength)

  function handleSelect(value: boolean) {
    setSelected(value)
    setTimeout(() => onNext({ includeStrength: value }), 150)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Do you want to include strength training?
        </h2>
        <p className="text-sm text-muted-foreground">
          You can change this later.
        </p>
      </div>
      <div className="space-y-3">
        <OnboardingCard
          label="Yes, include it"
          description="2×/week resistance + core — shown to improve running economy"
          selected={selected === true}
          onClick={() => handleSelect(true)}
        />
        <OnboardingCard
          label="No, running only"
          description="Running sessions only"
          selected={selected === false}
          onClick={() => handleSelect(false)}
        />
      </div>
    </div>
  )
}
