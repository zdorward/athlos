"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

type MileageConsistency = "lt-4w" | "4-12w" | "3-6m" | "6m-plus"

const OPTIONS: { value: MileageConsistency; label: string; description: string }[] = [
  { value: "lt-4w",    label: "Less than 4 weeks",  description: "Recently started at this volume" },
  { value: "4-12w",    label: "4–12 weeks",          description: "Building into this volume" },
  { value: "3-6m",     label: "3–6 months",          description: "Consistently training at this level" },
  { value: "6m-plus",  label: "6+ months",           description: "Well-established base" },
]

export function StepMileageConsistency({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<MileageConsistency | undefined>(formData.mileageConsistency)

  function handleSelect(value: MileageConsistency) {
    setSelected(value)
    setTimeout(() => onNext({ mileageConsistency: value }), 150)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          How long have you been training at this weekly mileage?
        </h2>
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
