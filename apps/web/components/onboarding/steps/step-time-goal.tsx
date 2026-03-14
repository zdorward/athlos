"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

export function StepTimeGoal({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<boolean | undefined>(formData.timeGoal)

  function handleSelect(value: boolean) {
    setSelected(value)
    setTimeout(() => onNext({ timeGoal: value }), 150)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Do you have a time goal?</h2>
        <p className="text-sm text-muted-foreground">
          A time goal helps us calibrate your pacing and intensity.
        </p>
      </div>
      <div className="space-y-3">
        <OnboardingCard
          label="Yes"
          description="I'll ask for your target finish time"
          selected={selected === true}
          onClick={() => handleSelect(true)}
        />
        <OnboardingCard
          label="No"
          description="Your plan will focus on completion"
          selected={selected === false}
          onClick={() => handleSelect(false)}
        />
      </div>
    </div>
  )
}
