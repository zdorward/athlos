"use client"

import { format } from "date-fns"
import { Star } from "lucide-react"
import type { WorkoutDay } from "@workspace/ai"
import {
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
} from "./workout-utils"

interface PlanDayDetailProps {
  day: WorkoutDay | null
  units: "km" | "miles"
  onClose?: () => void
}

export function PlanDayDetail({ day, units, onClose }: PlanDayDetailProps) {
  if (!day) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-subtle-foreground">Select a workout to see details</p>
      </div>
    )
  }

  const color = getWorkoutColor(day.type)
  const textClass = WORKOUT_TEXT_CLASS[day.type]
  const colorStyle = color ? { color } : undefined

  return (
    <div className="space-y-6 p-6">
      {onClose && (
        <button
          onClick={onClose}
          className="mb-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          ✕ Close
        </button>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-1">
          {format(new Date(day.date), "EEEE, MMM d, yyyy")}
        </p>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          {day.type === "race" && <Star className="h-5 w-5 fill-primary text-primary" />}
          <span className={textClass} style={colorStyle}>
            {WORKOUT_NAMES[day.type]}
          </span>
        </h2>
      </div>

      {day.distanceKm != null && (
        <div>
          <span
            className={`text-5xl font-bold tracking-tight font-mono ${textClass}`}
            style={colorStyle}
          >
            {formatDistance(day.distanceKm, units)}
          </span>
          <span className="ml-2 text-lg text-muted-foreground">{distanceUnit(units)}</span>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-2">
          Workout
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">{day.description}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-2">
          Target HR Zone
        </p>
        <p className="text-sm text-subtle-foreground">—</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-2">
          Target Pace
        </p>
        <p className="text-sm text-subtle-foreground">—</p>
      </div>
    </div>
  )
}
