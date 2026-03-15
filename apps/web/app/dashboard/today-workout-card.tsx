"use client"

import { Check } from "lucide-react"
import type { WorkoutDay } from "@workspace/ai"
import {
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
} from "@/app/plan/workout-utils"

interface TodayWorkoutCardProps {
  entry: WorkoutDay
  units: "km" | "miles"
  onComplete: () => void
  onLogEffort: (effort: "hard" | "good" | "easy") => void
  variant?: "today" | "preview"
}

const EFFORT_OPTIONS: { value: "hard" | "good" | "easy"; emoji: string; label: string }[] = [
  { value: "hard", emoji: "😓", label: "Hard" },
  { value: "good", emoji: "😊", label: "Good" },
  { value: "easy", emoji: "⚡", label: "Easy" },
]

export function TodayWorkoutCard({ entry, units, onComplete, onLogEffort, variant = "today" }: TodayWorkoutCardProps) {
  const isPreview = variant === "preview"
  const isComplete = entry.completed === true
  const hasEffort = entry.effort !== undefined
  const showEffortPicker = isComplete && !hasEffort && !isPreview

  const color = getWorkoutColor(entry.type)
  const textClass = WORKOUT_TEXT_CLASS[entry.type]
  const unit = distanceUnit(units)

  if (isComplete) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 border-l-[3px] border-l-green-500 p-4 space-y-3">
        {/* Completed header */}
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 shrink-0">
            <Check className="h-3 w-3 text-white" />
          </span>
          <div>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
              {WORKOUT_NAMES[entry.type]}
              {entry.distanceKm != null && (
                <span className="font-normal text-green-600/70 dark:text-green-500/70 ml-1.5">
                  · {formatDistance(entry.distanceKm, units)} {unit}
                </span>
              )}
            </p>
            {entry.effort && (
              <p className="text-xs text-green-600/60 dark:text-green-500/60 mt-0.5">
                <span aria-hidden="true">{EFFORT_OPTIONS.find((o) => o.value === entry.effort)?.emoji}</span>{" "}
                {EFFORT_OPTIONS.find((o) => o.value === entry.effort)?.label}
              </p>
            )}
          </div>
        </div>

        {/* Inline effort picker — only shown if not yet logged */}
        {showEffortPicker && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400">
              How did it feel?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {EFFORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onLogEffort(opt.value)}
                  className="flex flex-col items-center gap-1 rounded-lg border border-green-500/20 bg-white/50 dark:bg-white/5 px-2 py-2 text-center hover:bg-green-500/10 transition-colors cursor-pointer"
                >
                  <span className="text-xl leading-none" aria-hidden="true">{opt.emoji}</span>
                  <span className="text-[11px] font-semibold text-green-700 dark:text-green-400">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Incomplete state
  const borderStyle = color
    ? { borderLeftColor: color }
    : entry.type === "long" || entry.type === "race"
    ? { borderLeftColor: "var(--primary)" }
    : { borderLeftColor: "var(--muted-foreground)" }

  return (
    <div
      className={[
        "rounded-xl border border-border border-l-[3px] bg-card p-4",
        isPreview ? "opacity-50" : "",
      ].join(" ")}
      style={borderStyle}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-semibold uppercase tracking-wider ${textClass}`}
            style={color ? { color } : undefined}
          >
            {WORKOUT_NAMES[entry.type]}
          </p>
          {entry.distanceKm != null && (
            <p className="text-2xl font-extrabold tabular-nums leading-tight mt-0.5">
              {formatDistance(entry.distanceKm, units)}{" "}
              <span className="text-sm font-normal text-muted-foreground">{unit}</span>
            </p>
          )}
        </div>
      </div>

      {entry.description && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          {entry.description}
        </p>
      )}

      {!isPreview && (
        <button
          onClick={onComplete}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
        >
          Mark Complete
        </button>
      )}
    </div>
  )
}
