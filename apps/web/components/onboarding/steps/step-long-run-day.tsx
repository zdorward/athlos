"use client"

import { useState } from "react"
import { DayToggle } from "../day-toggle"
import { DAY_LABELS, ORDERED_DAYS, type Day, type StepProps } from "../types"

export function StepLongRunDay({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<Day | undefined>(formData.longRunDay)
  const days = formData.selectedDays ?? []

  function handleSelect(day: Day) {
    setSelected(day)
    setTimeout(() => onNext({ longRunDay: day }), 150)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Which day would you like your long run?
        </h2>
        <p className="text-sm text-muted-foreground">
          Your longest run of the week will be scheduled on this day.
        </p>
      </div>

      <div className="flex w-full justify-between">
        {ORDERED_DAYS.map((day) => {
          const available = days.includes(day)
          return (
            <DayToggle
              key={day}
              day={day}
              label={DAY_LABELS[day].short}
              selected={selected === day}
              disabled={!available}
              onClick={() => available && handleSelect(day)}
            />
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Only your selected running days are available.
      </p>
    </div>
  )
}
