"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

export function StepFirstAtDistance({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<boolean | undefined>(formData.isFirstAtDistance)
  const distance = formData.race?.distance
  const heading = distance === "half"
    ? "Is this your first half marathon?"
    : "Is this your first marathon?"

  function handleSelect(value: boolean) {
    setSelected(value)
    setTimeout(() => onNext({ isFirstAtDistance: value }), 150)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
        <p className="text-sm text-muted-foreground">
          This helps us set the right training load and safeguards for your plan.
        </p>
      </div>
      <div className="space-y-3">
        <OnboardingCard
          label="Yes, it's my first"
          selected={selected === true}
          onClick={() => handleSelect(true)}
        />
        <OnboardingCard
          label="No, I've done one before"
          selected={selected === false}
          onClick={() => handleSelect(false)}
        />
      </div>
    </div>
  )
}
