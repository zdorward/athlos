"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { DayToggle } from "../day-toggle"
import { ORDERED_DAYS, DAY_LABELS, type Day, type StepProps } from "../types"

export function StepWhichDays({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selectedDays, setSelectedDays] = useState<Day[]>(formData.selectedDays ?? [])
  const [longRunDay, setLongRunDay] = useState<Day | undefined>(formData.longRunDay)

  function toggleDay(day: Day) {
    setSelectedDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
      if (longRunDay && !next.includes(longRunDay)) setLongRunDay(undefined)
      return next
    })
  }

  const canAdvance = selectedDays.length > 0 && longRunDay !== undefined

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Set up your running week.</h2>
        <p className="text-sm text-muted-foreground">Pick the days you're available to run, then choose which one is your long run.</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Running days</p>
          <div className="flex w-full justify-center gap-2">
            {ORDERED_DAYS.map((day) => (
              <DayToggle
                key={day}
                day={day}
                label={DAY_LABELS[day].short}
                selected={selectedDays.includes(day)}
                onClick={() => toggleDay(day)}
              />
            ))}
          </div>
        </div>

        <div
          className="space-y-3 transition-opacity duration-300"
          style={{ opacity: selectedDays.length > 0 ? 1 : 0.25, pointerEvents: selectedDays.length > 0 ? "auto" : "none" }}
        >
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Long run day</p>
          <div className="flex w-full justify-center gap-2">
            {ORDERED_DAYS.map((day) => {
              const available = selectedDays.includes(day)
              return (
                <DayToggle
                  key={day}
                  day={day}
                  label={DAY_LABELS[day].short}
                  selected={longRunDay === day}
                  disabled={!available}
                  onClick={() => available && setLongRunDay(day)}
                />
              )
            })}
          </div>
        </div>
      </div>

      <Button
        onClick={() => onNext({ selectedDays, longRunDay })}
        disabled={!canAdvance}
        className="w-full"
      >
        Next
      </Button>
    </div>
  )
}
