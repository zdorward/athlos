"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { DayToggle } from "./day-toggle"
import { ORDERED_DAYS, DAY_LABELS, type Day } from "./types"

interface StepDayPickerProps {
  title: string
  description?: string
  initialDays: Day[]
  onNext: (days: Day[]) => void
}

export function StepDayPicker({ title, description, initialDays, onNext }: StepDayPickerProps) {
  const [selected, setSelected] = useState<Day[]>(initialDays)

  const allSelected = selected.length === ORDERED_DAYS.length

  function toggle(day: Day) {
    setSelected((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  function toggleAll() {
    setSelected(allSelected ? [] : [...ORDERED_DAYS])
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

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

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selected.length === 0
            ? "Select at least one day"
            : `${selected.length} day${selected.length === 1 ? "" : "s"} selected`}
        </p>
        <button
          onClick={toggleAll}
          className="text-sm text-primary hover:text-primary/80 transition-colors cursor-pointer"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

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
