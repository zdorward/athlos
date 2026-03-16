"use client"

import { useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import type { StepProps } from "../types"

export function StepGoalTime({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [hours, setHours] = useState(formData.goalTime?.hours.toString() ?? "")
  const [minutes, setMinutes] = useState(
    formData.goalTime?.minutes !== undefined
      ? formData.goalTime.minutes.toString().padStart(2, "0")
      : ""
  )
  const [justFinish, setJustFinish] = useState(formData.timeGoal === false)
  const hoursRef = useRef<HTMLInputElement>(null)
  const minutesRef = useRef<HTMLInputElement>(null)

  const h = parseInt(hours, 10)
  const m = parseInt(minutes, 10)
  const timeIsValid =
    hours !== "" && minutes !== "" &&
    !isNaN(h) && !isNaN(m) &&
    h >= 0 && h <= 23 &&
    m >= 0 && m <= 59

  const canAdvance = justFinish || timeIsValid

  function handleHoursChange(val: string) {
    const n = val.replace(/\D/g, "").slice(0, 2)
    setHours(n)
    setJustFinish(false)
  }

  function handleMinutesChange(val: string) {
    const n = val.replace(/\D/g, "").slice(0, 2)
    if (n === "" || parseInt(n, 10) <= 59) {
      setMinutes(n)
      setJustFinish(false)
    }
  }

  function handleJustFinish() {
    setJustFinish(true)
    setHours("")
    setMinutes("")
    setTimeout(() => onNext({ timeGoal: false, goalTime: undefined }), 150)
  }

  function handleNext() {
    if (!canAdvance) return
    if (justFinish) {
      onNext({ timeGoal: false, goalTime: undefined })
    } else {
      onNext({ timeGoal: true, goalTime: { hours: h, minutes: m } })
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">What&apos;s your goal time?</h2>
        <p className="text-sm text-muted-foreground">We&apos;ll use this to calibrate your pacing and intensity.</p>
      </div>

      <div className="flex items-center justify-center gap-3">
        <div className="flex flex-col items-center gap-2">
          <input
            ref={hoursRef}
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={hours}
            onChange={(e) => handleHoursChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); minutesRef.current?.focus() }
            }}
            className="w-24 rounded-xl border border-border bg-muted/50 py-4 text-center text-4xl font-semibold tracking-tight outline-none focus:border-primary focus:bg-background transition-colors"
          />
          <span className="text-xs text-muted-foreground">hours</span>
        </div>

        <span className="text-4xl font-semibold text-muted-foreground">:</span>

        <div className="flex flex-col items-center gap-2">
          <input
            ref={minutesRef}
            type="text"
            inputMode="numeric"
            placeholder="00"
            value={minutes}
            onChange={(e) => handleMinutesChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") { e.preventDefault(); hoursRef.current?.focus() }
            }}
            className="w-24 rounded-xl border border-border bg-muted/50 py-4 text-center text-4xl font-semibold tracking-tight outline-none focus:border-primary focus:bg-background transition-colors"
          />
          <span className="text-xs text-muted-foreground">minutes</span>
        </div>
      </div>

      <div className="space-y-4">
        <Button onClick={handleNext} disabled={!canAdvance} className="w-full">
          Next
        </Button>
        <div className="text-center">
          <button
            onClick={handleJustFinish}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            I don&apos;t have a goal time
          </button>
        </div>
      </div>
    </div>
  )
}
