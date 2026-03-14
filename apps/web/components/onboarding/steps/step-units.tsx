"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps, Units } from "../types"

export function StepUnits({ onNext }: Pick<StepProps, "onNext">) {
  const [selected, setSelected] = useState<Units | undefined>(undefined)

  function handleSelect(units: Units) {
    setSelected(units)
    onNext({ units })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Do you prefer km or miles?</h2>
      <div className="space-y-3">
        <OnboardingCard
          label="km"
          selected={selected === "km"}
          onClick={() => handleSelect("km")}
        />
        <OnboardingCard
          label="miles"
          selected={selected === "miles"}
          onClick={() => handleSelect("miles")}
        />
      </div>
    </div>
  )
}
