"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

export function StepTimeGoal({ onNext }: Pick<StepProps, "onNext">) {
  const [selected, setSelected] = useState<boolean | undefined>(undefined)

  function handleSelect(value: boolean) {
    setSelected(value)
    onNext({ timeGoal: value })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        Do you have a time goal?
      </h2>
      <div className="space-y-3">
        <OnboardingCard
          label="Yes"
          selected={selected === true}
          onClick={() => handleSelect(true)}
        />
        <OnboardingCard
          label="No"
          selected={selected === false}
          onClick={() => handleSelect(false)}
        />
      </div>
    </div>
  )
}
