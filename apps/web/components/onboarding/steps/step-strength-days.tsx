"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { DayToggle } from "../day-toggle"
import { ORDERED_DAYS, DAY_LABELS, type Day, type StepProps } from "../types"

export function StepStrengthDays({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<Day[]>(formData.strengthDays ?? [])

  function toggle(day: Day) {
    setSelected((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Which days do you want to lift?</h2>
        <p className="text-sm text-muted-foreground">Pick days that don't clash with your hard running sessions.</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Lifting days</p>
        <div className="flex w-full justify-center gap-2">
          {ORDERED_DAYS.map((day) => (
            <DayToggle
              key={day}
              day={day}
              label={DAY_LABELS[day].short}
              selected={selected.includes(day)}
              onClick={() => toggle(day)}
            />
          ))}
        </div>
      </div>

      <Button
        onClick={() => onNext({ strengthDays: selected })}
        disabled={selected.length === 0}
        className="w-full"
      >
        Next
      </Button>
    </div>
  )
}
