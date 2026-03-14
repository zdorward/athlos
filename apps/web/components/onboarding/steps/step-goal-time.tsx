"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import type { StepProps } from "../types"

export function StepGoalTime({ onNext }: Pick<StepProps, "onNext">) {
  const [hours, setHours] = useState("")
  const [minutes, setMinutes] = useState("")

  const h = parseInt(hours, 10)
  const m = parseInt(minutes, 10)
  const isValid =
    hours !== "" && minutes !== "" &&
    !isNaN(h) && !isNaN(m) &&
    h >= 0 && h <= 23 &&
    m >= 0 && m <= 59

  function handleHoursChange(val: string) {
    const n = val.replace(/\D/g, "").slice(0, 2)
    setHours(n)
  }

  function handleMinutesChange(val: string) {
    const n = val.replace(/\D/g, "").slice(0, 2)
    if (n === "" || parseInt(n, 10) <= 59) setMinutes(n)
  }

  function handleNext() {
    if (!isValid) return
    onNext({ goalTime: { hours: h, minutes: m } })
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">What's your time goal?</h2>
        <p className="text-sm text-muted-foreground">Enter your target finish time</p>
      </div>

      <div className="flex items-center justify-center gap-3">
        <div className="flex flex-col items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={hours}
            onChange={(e) => handleHoursChange(e.target.value)}
            className="w-24 rounded-xl border border-border bg-muted/50 py-4 text-center text-4xl font-semibold tracking-tight outline-none focus:border-primary focus:bg-background transition-colors"
          />
          <span className="text-xs text-muted-foreground">hours</span>
        </div>

        <span className="mb-6 text-4xl font-semibold text-muted-foreground">:</span>

        <div className="flex flex-col items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="00"
            value={minutes}
            onChange={(e) => handleMinutesChange(e.target.value)}
            className="w-24 rounded-xl border border-border bg-muted/50 py-4 text-center text-4xl font-semibold tracking-tight outline-none focus:border-primary focus:bg-background transition-colors"
          />
          <span className="text-xs text-muted-foreground">minutes</span>
        </div>
      </div>

      <Button onClick={handleNext} disabled={!isValid} className="w-full">
        Next
      </Button>
    </div>
  )
}
