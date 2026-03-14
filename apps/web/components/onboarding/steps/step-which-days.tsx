"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { DayToggle } from "../day-toggle"
import { ORDERED_DAYS, DAY_LABELS, type Day, type OnboardingData } from "../types"

interface StepWhichDaysProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

export function StepWhichDays({ formData, onNext }: StepWhichDaysProps) {
  const daysPerWeek = formData.daysPerWeek ?? 3
  const [selected, setSelected] = useState<Day[]>(formData.selectedDays ?? [])

  function toggle(day: Day) {
    if (selected.includes(day)) {
      setSelected(selected.filter((d) => d !== day))
    } else {
      if (selected.length < daysPerWeek) {
        setSelected([...selected, day])
      }
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        Which days are you free to run?
      </h2>

      <div className="flex gap-2">
        {ORDERED_DAYS.map((day) => (
          <DayToggle
            key={day}
            day={day}
            label={DAY_LABELS[day].short}
            selected={selected.includes(day)}
            onClick={() => toggle(day)}
            disabled={selected.length >= daysPerWeek && !selected.includes(day)}
          />
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Select {daysPerWeek} days ({selected.length} selected)
      </p>

      <Button
        onClick={() => onNext({ selectedDays: selected })}
        disabled={selected.length !== daysPerWeek}
        className="w-full"
      >
        Next
      </Button>
    </div>
  )
}
