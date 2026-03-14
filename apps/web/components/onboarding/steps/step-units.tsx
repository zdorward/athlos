"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps, Units } from "../types"

export function StepUnits({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<Units | undefined>(formData.units)

  function handleSelect(units: Units) {
    setSelected(units)
    setTimeout(() => onNext({ units }), 150)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Do you prefer km or miles?</h2>
        <p className="text-sm text-muted-foreground">
          All distances in your plan will use this unit.
        </p>
      </div>
      <div className="space-y-3">
        <OnboardingCard
          label="Kilometres"
          description="Distances shown in km"
          selected={selected === "km"}
          onClick={() => handleSelect("km")}
        />
        <OnboardingCard
          label="Miles"
          description="Distances shown in miles"
          selected={selected === "miles"}
          onClick={() => handleSelect("miles")}
        />
      </div>
    </div>
  )
}
