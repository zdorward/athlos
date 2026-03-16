// apps/web/components/onboarding/steps/step-which-days.tsx
"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { DayToggle } from "../day-toggle"
import { cn } from "@workspace/ui/lib/utils"
import { ORDERED_DAYS, DAY_LABELS, type Day, type StepProps } from "../types"

type Preset = 4 | 5 | 6 | 7

const PRESET_DEFAULTS: Record<Preset, Day[]> = {
  4: ["mon", "wed", "fri", "sun"],
  5: ["mon", "tue", "thu", "fri", "sun"],
  6: ["mon", "tue", "wed", "thu", "fri", "sun"],
  7: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
}

const LONG_RUN_DEFAULT: Day = "sun"

function detectPreset(days: Day[]): Preset | null {
  if (days.length === 7) return 7
  if (days.length === 6) return 6
  if (days.length === 5) return 5
  if (days.length === 4) return 4
  return null
}

export function StepWhichDays({
  formData,
  onNext,
}: Pick<StepProps, "formData" | "onNext">) {
  const initialDays = formData.selectedDays ?? PRESET_DEFAULTS[6]
  const [preset, setPreset] = useState<Preset | null>(() => detectPreset(initialDays))
  const [selectedDays, setSelectedDays] = useState<Day[]>(initialDays)
  const [longRunDay, setLongRunDay] = useState<Day | undefined>(
    formData.longRunDay ?? LONG_RUN_DEFAULT
  )

  function applyPreset(p: Preset) {
    setPreset(p)
    setSelectedDays(PRESET_DEFAULTS[p])
    setLongRunDay(LONG_RUN_DEFAULT)
  }

  function toggleDay(day: Day) {
    setSelectedDays((prev) => {
      const next = prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
      // Clear long run day if it's no longer in the selected days
      if (longRunDay && !next.includes(longRunDay)) setLongRunDay(undefined)
      // Keep preset indicator in sync with actual day count
      setPreset(detectPreset(next))
      return next
    })
  }

  const canAdvance = selectedDays.length > 0 && longRunDay !== undefined

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Set up your running week.
        </h2>
        <p className="text-sm text-muted-foreground">
          Most advanced runners train 6 days a week. Adjust to fit your
          schedule.
        </p>
      </div>

      {/* Preset tabs */}
      <div className="flex gap-2">
        {([4, 5, 6, 7] as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className={cn(
              "flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              preset === p
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted"
            )}
          >
            {p} days
          </button>
        ))}
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Running days
          </p>
          <div className="flex w-full justify-between gap-2">
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
          style={{
            opacity: selectedDays.length > 0 ? 1 : 0.25,
            pointerEvents: selectedDays.length > 0 ? "auto" : "none",
          }}
        >
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Long run day
          </p>
          <div className="flex w-full justify-between gap-2">
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
        onClick={() => canAdvance && onNext({ selectedDays, longRunDay })}
        disabled={!canAdvance}
        className="w-full"
      >
        Next
      </Button>
    </div>
  )
}
