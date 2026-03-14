import { format, parseISO } from "date-fns"
import type { WorkoutDay } from "@workspace/ai"
import {
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
} from "@/app/plan/workout-utils"

export type DayCardState =
  | { kind: "workout"; entry: WorkoutDay }
  | { kind: "rest" }
  | { kind: "before-start"; startDate: string }
  | { kind: "after-end" }

interface WorkoutCardProps {
  state: DayCardState
  dateISO: string
  units: "km" | "miles"
  variant: "hero" | "preview"
}

export function WorkoutCard({ state, dateISO, units, variant }: WorkoutCardProps) {
  const isHero = variant === "hero"
  const dateLabel = format(parseISO(dateISO), "EEEE, MMM d")

  if (state.kind === "before-start") {
    return (
      <div className={`rounded-xl border border-border bg-card p-4 ${isHero ? "" : "opacity-60"}`}>
        <p className="text-sm text-muted-foreground">
          Your plan starts on {format(parseISO(state.startDate), "EEEE, MMM d")}.
        </p>
      </div>
    )
  }

  if (state.kind === "after-end") {
    return (
      <div className={`rounded-xl border border-border bg-card p-4 ${isHero ? "" : "opacity-60"}`}>
        <p className="text-sm text-muted-foreground">Your plan is complete 🎉</p>
      </div>
    )
  }

  if (state.kind === "rest") {
    return (
      <div className={`rounded-xl border border-border bg-card p-4 ${isHero ? "" : "opacity-60"}`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
          Rest Day
        </p>
        {isHero && (
          <p className="mt-1 text-sm text-muted-foreground">Recovery is part of training.</p>
        )}
      </div>
    )
  }

  // state.kind === "workout"
  const { entry } = state
  const textClass = WORKOUT_TEXT_CLASS[entry.type]
  const inlineColor = getWorkoutColor(entry.type)

  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${isHero ? "" : "opacity-60"}`}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${textClass}`}
          style={inlineColor ? { color: inlineColor } : undefined}
        >
          {WORKOUT_NAMES[entry.type]}
        </span>
        {entry.distanceKm !== undefined && (
          <span className="text-sm font-semibold tabular-nums">
            {formatDistance(entry.distanceKm, units)}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {distanceUnit(units)}
            </span>
          </span>
        )}
      </div>
      {isHero && (
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {entry.description}
        </p>
      )}
    </div>
  )
}
