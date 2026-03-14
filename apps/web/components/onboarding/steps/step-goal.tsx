"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { Goal, StepProps } from "../types"

export function StepGoal({ onNext }: Pick<StepProps, "onNext">) {
  const [selected, setSelected] = useState<Goal | undefined>(undefined)

  function handleSelect(goal: Goal) {
    setSelected(goal)
    onNext({ goal })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        What is your running goal?
      </h2>
      <div className="space-y-3">
        <OnboardingCard
          label="Race"
          description="Train for a specific race event"
          selected={selected === "race"}
          onClick={() => handleSelect("race")}
        />
        <OnboardingCard
          label="Build Aerobic Base"
          description="Improve your general fitness and endurance"
          selected={selected === "aerobic_base"}
          onClick={() => handleSelect("aerobic_base")}
        />
      </div>
    </div>
  )
}
