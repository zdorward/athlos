"use client"

import { format, parseISO } from "date-fns"
import { Star, Check } from "lucide-react"
import type { WorkoutDay, WorkoutType, PhaseEntry } from "@workspace/ai"
import { PlanDayDetail } from "./plan-day-detail"
import {
  groupDaysByWeek,
  getPhaseLabel,
  getTaperWeeks,
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
} from "./workout-utils"

interface PlanFeedProps {
  days: WorkoutDay[]
  units: "km" | "miles"
  totalWeeks: number
  raceDistance?: "5k" | "10k" | "half" | "full" | "ultra"
  onToggleComplete?: (date: string, type: WorkoutType, completed: boolean) => void
  onSaveEdit?: (
    date: string,
    originalType: WorkoutType,
    update: {
      type?: WorkoutType
      distanceKm?: number | null
      description?: string
      targetHR?: string
      targetPace?: string
    }
  ) => void
  selectedKey: { date: string; type: WorkoutType } | null
  onSelectedKeyChange: (key: { date: string; type: WorkoutType } | null) => void
  phases?: PhaseEntry[]
}

export function PlanFeed({ days, units, totalWeeks, raceDistance, onToggleComplete, onSaveEdit, selectedKey, onSelectedKeyChange, phases }: PlanFeedProps) {
  // Derive the live WorkoutDay from days so the detail sheet always reflects current state
  const selectedDay = selectedKey
    ? (days.find((d) => d.date === selectedKey.date && d.type === selectedKey.type) ?? null)
    : null
  const weeks = groupDaysByWeek(days)
  const taperWeeks = getTaperWeeks(raceDistance)
  const unit = distanceUnit(units)

  if (weeks.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-subtle-foreground">
        Generating your plan…
      </div>
    )
  }

  return (
    <>
      <div className="px-4 pb-24 space-y-2">
        {weeks.map((weekDays, weekIdx) => {
          if (!weekDays) return null
          const weekNum = weekIdx + 1
          const phase = totalWeeks > 0 ? getPhaseLabel(weekNum, totalWeeks, taperWeeks, phases) : ""
          const weeklyKm = weekDays.reduce((sum, d) => sum + (d.distanceKm ?? 0), 0)
          const firstDate = weekDays[0] ? format(parseISO(weekDays[0].date), "MMM d") : ""
          const lastDate = weekDays[weekDays.length - 1]
            ? format(parseISO(weekDays[weekDays.length - 1]!.date), "MMM d")
            : ""

          return (
            <div key={weekIdx}>
              {/* Week divider */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-xs font-semibold">
                    Week {weekNum}{phase ? ` — ${phase}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {firstDate}–{lastDate}
                  </p>
                </div>
                {weeklyKm > 0 && (
                  <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold tabular-nums">
                    {formatDistance(weeklyKm, units)} {unit}
                  </span>
                )}
              </div>

              {/* Day cards */}
              <div className="space-y-1.5">
                {weekDays.map((day) => {
                  const isRest = day.type === "rest"
                  const isRace = day.type === "race"
                  const isSelected = selectedKey?.date === day.date && selectedKey?.type === day.type
                  const color = getWorkoutColor(day.type)
                  const textClass = WORKOUT_TEXT_CLASS[day.type]

                  const borderStyle = color
                    ? { borderLeftColor: color }
                    : day.type === "long" || day.type === "race"
                    ? { borderLeftColor: "var(--primary)" }
                    : day.type === "rest"
                    ? { borderLeftColor: "var(--subtle-foreground)" }
                    : { borderLeftColor: "var(--muted-foreground)" }

                  const isComplete = !isRest && day.completed === true
                  const effectiveBorderStyle = isComplete
                    ? { borderLeftColor: "#22c55e" }
                    : borderStyle

                  return (
                    <button
                      key={`${day.date}-${day.type}`}
                      onClick={() => onSelectedKeyChange(isSelected ? null : { date: day.date, type: day.type })}
                      className={[
                        "w-full rounded-lg border border-l-4 p-3 text-left transition-colors cursor-pointer",
                        isRace
                          ? "bg-primary/12 border-border"
                          : isComplete
                          ? "bg-green-500/5 border-border"
                          : isSelected
                          ? "bg-muted border-border"
                          : "bg-card border-border hover:bg-muted",
                        isRest ? "opacity-40" : "",
                      ].join(" ")}
                      style={effectiveBorderStyle}
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Date */}
                        <div className="flex flex-col items-center w-10 shrink-0">
                          <p className="text-lg font-bold tabular-nums leading-none">
                            {format(parseISO(day.date), "d")}
                          </p>
                          <p className="text-[9px] font-semibold uppercase tracking-widest text-subtle-foreground">
                            {format(parseISO(day.date), "EEE")}
                          </p>
                        </div>

                        {/* Workout info */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-semibold flex items-center gap-1.5 ${textClass}`}
                            style={color ? { color } : undefined}
                          >
                            {isRace && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                            {isComplete && <Check className="h-4 w-4 text-green-600" />}
                            {WORKOUT_NAMES[day.type]}
                          </p>
                          {!isRest && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {day.description}
                            </p>
                          )}
                        </div>

                        {/* Distance */}
                        {day.distanceKm != null && (
                          <div className="text-right shrink-0">
                            <p
                              className={`text-lg font-bold tabular-nums ${textClass}`}
                              style={color ? { color } : undefined}
                            >
                              {formatDistance(day.distanceKm, units)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{unit}</p>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom sheet overlay for detail */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => onSelectedKeyChange(null)}>
          <div
            className="w-full max-h-[70vh] overflow-y-auto rounded-t-xl bg-card border-t border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-border mb-2" />
            <PlanDayDetail day={selectedDay} units={units} onClose={() => onSelectedKeyChange(null)} onToggleComplete={onToggleComplete} onSaveEdit={onSaveEdit} />
          </div>
        </div>
      )}
    </>
  )
}
