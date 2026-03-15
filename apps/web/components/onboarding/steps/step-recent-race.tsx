"use client"

import { useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { OnboardingCard } from "../onboarding-card"
import { DISTANCE_LABELS, type StepProps } from "../types"

type RaceDistance = "5k" | "10k" | "half" | "full"
type FitnessContext = "active" | "short-break" | "long-break"

const DISTANCES: { value: RaceDistance; label: string }[] = [
  { value: "5k",   label: DISTANCE_LABELS["5k"] },
  { value: "10k",  label: DISTANCE_LABELS["10k"] },
  { value: "half", label: DISTANCE_LABELS["half"] },
  { value: "full", label: DISTANCE_LABELS["full"] },
]

const CONTEXT_OPTIONS: { value: FitnessContext; label: string; description: string }[] = [
  { value: "active",       label: "Actively training",       description: "Running regularly right now" },
  { value: "short-break",  label: "Took a short break",      description: "Off for less than 2 months" },
  { value: "long-break",   label: "Been off for a while",    description: "2+ months since regular training" },
]

export function StepRecentRace({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [distance, setDistance] = useState<RaceDistance | undefined>(
    formData.recentRace?.distance
  )
  const [hours,   setHours]   = useState(formData.recentRace?.hours.toString() ?? "")
  const [minutes, setMinutes] = useState(
    formData.recentRace?.minutes !== undefined
      ? formData.recentRace.minutes.toString().padStart(2, "0")
      : ""
  )
  const [seconds, setSeconds] = useState(
    formData.recentRace?.seconds !== undefined
      ? formData.recentRace.seconds.toString().padStart(2, "0")
      : ""
  )
  const [context, setContext] = useState<FitnessContext | undefined>(
    formData.recentRace?.context
  )

  const minutesRef = useRef<HTMLInputElement>(null)
  const secondsRef = useRef<HTMLInputElement>(null)

  const h = parseInt(hours,   10)
  const m = parseInt(minutes, 10)
  const s = parseInt(seconds, 10)

  const timeIsValid =
    distance !== undefined &&
    hours !== "" && minutes !== "" && seconds !== "" &&
    !isNaN(h) && !isNaN(m) && !isNaN(s) &&
    h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59 &&
    (h * 3600 + m * 60 + s) > 0

  const canAdvance = timeIsValid && context !== undefined

  function handleNext() {
    if (!canAdvance || !distance || !context) return
    onNext({
      recentRace: { distance, hours: h, minutes: m, seconds: s, context },
    })
  }

  function handleSkip() {
    onNext({})
  }

  const inputCls =
    "w-16 rounded-xl border border-border bg-muted/50 py-3 text-center text-3xl font-semibold tracking-tight outline-none focus:border-primary focus:bg-background transition-colors"

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Any recent race results?</h2>
        <p className="text-sm text-muted-foreground">
          A recent finish time gives us accurate pacing zones. Skip if you don&apos;t have one.
        </p>
      </div>

      {/* Distance picker */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Distance
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DISTANCES.map((d) => (
            <OnboardingCard
              key={d.value}
              label={d.label}
              selected={distance === d.value}
              onClick={() => setDistance(d.value)}
            />
          ))}
        </div>
      </div>

      {/* Time entry */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Finish time
        </p>
        <div className="flex items-center justify-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={hours}
              onChange={(e) => setHours(e.target.value.replace(/\D/g, "").slice(0, 2))}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") { e.preventDefault(); minutesRef.current?.focus() }
              }}
              className={inputCls}
            />
            <span className="text-xs text-muted-foreground">h</span>
          </div>
          <span className="text-3xl font-semibold text-muted-foreground pb-4">:</span>
          <div className="flex flex-col items-center gap-1">
            <input
              ref={minutesRef}
              type="text"
              inputMode="numeric"
              placeholder="00"
              value={minutes}
              onChange={(e) => {
                const n = e.target.value.replace(/\D/g, "").slice(0, 2)
                if (n === "" || parseInt(n, 10) <= 59) setMinutes(n)
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft")  { e.preventDefault(); /* focus handled by browser */ }
                if (e.key === "ArrowRight") { e.preventDefault(); secondsRef.current?.focus() }
              }}
              className={inputCls}
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
          <span className="text-3xl font-semibold text-muted-foreground pb-4">:</span>
          <div className="flex flex-col items-center gap-1">
            <input
              ref={secondsRef}
              type="text"
              inputMode="numeric"
              placeholder="00"
              value={seconds}
              onChange={(e) => {
                const n = e.target.value.replace(/\D/g, "").slice(0, 2)
                if (n === "" || parseInt(n, 10) <= 59) setSeconds(n)
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") { e.preventDefault(); minutesRef.current?.focus() }
              }}
              className={inputCls}
            />
            <span className="text-xs text-muted-foreground">sec</span>
          </div>
        </div>
      </div>

      {/* Context picker — only shown after a valid time is entered */}
      {timeIsValid && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            How is your training going right now?
          </p>
          <div className="space-y-2">
            {CONTEXT_OPTIONS.map((opt) => (
              <OnboardingCard
                key={opt.value}
                label={opt.label}
                description={opt.description}
                selected={context === opt.value}
                onClick={() => setContext(opt.value)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Button onClick={handleNext} disabled={!canAdvance} className="w-full">
          Next
        </Button>
        <div className="text-center">
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Skip — use my goal time for pacing
          </button>
        </div>
      </div>
    </div>
  )
}
