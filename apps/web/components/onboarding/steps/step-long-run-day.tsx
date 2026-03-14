"use client"

import { useState } from "react"
import { ChevronLeft } from "lucide-react"
import { OnboardingCard } from "../onboarding-card"
import { DAY_LABELS, type Day, type StepProps } from "../types"

export function StepLongRunDay({ formData, onNext, onBack }: StepProps) {
  const [selected, setSelected] = useState<Day | undefined>(undefined)
  const days = formData.selectedDays ?? []

  if (days.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Something went wrong — please go back</p>
        <button
          onClick={onBack}
          className="flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      </div>
    )
  }

  function handleSelect(day: Day) {
    setSelected(day)
    onNext({ longRunDay: day })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        Which day would you like your long run?
      </h2>
      <div className="space-y-3">
        {days.map((day: Day) => (
          <OnboardingCard
            key={day}
            label={DAY_LABELS[day].full}
            selected={selected === day}
            onClick={() => handleSelect(day)}
          />
        ))}
      </div>
    </div>
  )
}
