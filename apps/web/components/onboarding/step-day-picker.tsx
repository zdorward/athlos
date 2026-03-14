"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { DayToggle } from "./day-toggle"
import { ORDERED_DAYS, DAY_LABELS, type Day } from "./types"

interface StepDayPickerProps {
  title: string
  initialDays: Day[]
  onNext: (days: Day[]) => void
}

export function StepDayPicker({ title, initialDays, onNext }: StepDayPickerProps) {
  const [selected, setSelected] = useState<Day[]>(initialDays)

  function toggle(day: Day) {
    setSelected((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>

      <div className="flex w-full justify-between">
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

      <p className="text-sm text-muted-foreground">
        {selected.length === 0
          ? "Select at least one day"
          : `${selected.length} day${selected.length === 1 ? "" : "s"} selected`}
      </p>

      <Button
        onClick={() => onNext(selected)}
        disabled={selected.length === 0}
        className="w-full"
      >
        Next
      </Button>
    </div>
  )
}
