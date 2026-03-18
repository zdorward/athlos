"use client"

import { format, parseISO } from "date-fns"
import { Star, Check } from "lucide-react"
import type { WorkoutDay, WorkoutType, PhaseEntry } from "@workspace/plan-engine"
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
  groupDaysByDate,
  RUN_TYPES,
} from "./workout-utils"

interface PlanFeedProps {
  days: WorkoutDay[]
  units: "km" | "miles"
  totalWeeks: number
  raceDistance?: "half" | "full"
  planStartDate?: string
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
  isNewlyGenerated?: boolean
}

export function PlanFeed({ days, units, totalWeeks, raceDistance, planStartDate, onToggleComplete, onSaveEdit, selectedKey, onSelectedKeyChange, phases, isNewlyGenerated }: PlanFeedProps) {
  // Derive the live WorkoutDay from days so the detail sheet always reflects current state
  const selectedDay = selectedKey
    ? (days.find((d) => d.date === selectedKey.date && d.type === selectedKey.type) ?? null)
    : null
  const planFirstMonday = planStartDate ?? days[0]?.date ?? null
  const planDays = planFirstMonday ? days.filter(d => d.date >= planFirstMonday) : days
  const weeks = groupDaysByWeek(planDays)
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
            <div
              key={weekIdx}
              className={isNewlyGenerated ? "animate-fade-in" : undefined}
              style={isNewlyGenerated ? {
                animationDelay: `${weekIdx * 30}ms`,
                animationFillMode: "both",
              } : undefined}
            >
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
                {Array.from(groupDaysByDate(weekDays).values()).map((entries) => {
                  const primary = entries.find((e) => RUN_TYPES.has(e.type)) ?? entries[0]!
                  const secondaryEntries = entries.filter((e) => e !== primary && e.type !== "rest")
                  const isRest = entries.every((e) => e.type === "rest")
                  const isRace = entries.some((e) => e.type === "race")
                  const isSelected =
                    selectedKey?.date === primary.date && selectedKey?.type === primary.type
                  const isComplete =
                    !isRest && entries.filter((e) => e.type !== "rest").every((e) => e.completed === true)
                  const color = getWorkoutColor(primary.type)
                  const textClass = WORKOUT_TEXT_CLASS[primary.type]

                  const borderStyle = color
                    ? { borderLeftColor: color }
                    : primary.type === "long" || primary.type === "race"
                    ? { borderLeftColor: "var(--primary)" }
                    : primary.type === "rest"
                    ? { borderLeftColor: "var(--subtle-foreground)" }
                    : { borderLeftColor: "var(--muted-foreground)" }

                  const effectiveBorderStyle = isComplete
                    ? { borderLeftColor: "#22c55e" }
                    : borderStyle

                  return (
                    <button
                      key={`${primary.date}-${primary.type}`}
                      onClick={() =>
                        onSelectedKeyChange(isSelected ? null : { date: primary.date, type: primary.type })
                      }
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
                            {format(parseISO(primary.date), "d")}
                          </p>
                          <p className="text-[9px] font-semibold uppercase tracking-widest text-subtle-foreground">
                            {format(parseISO(primary.date), "EEE")}
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
                            {WORKOUT_NAMES[primary.type]}
                          </p>
                          {secondaryEntries.length > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-border/[0.06]">
                              {secondaryEntries.map((entry) => {
                                const secColor = getWorkoutColor(entry.type)
                                const secTextClass = WORKOUT_TEXT_CLASS[entry.type]
                                return (
                                  <p
                                    key={entry.type}
                                    className={`text-xs font-medium ${secTextClass}`}
                                    style={secColor ? { color: secColor } : undefined}
                                  >
                                    {WORKOUT_NAMES[entry.type]}
                                  </p>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        {/* Distance */}
                        {primary.distanceKm != null && (
                          <div className="text-right shrink-0">
                            <p
                              className={`text-lg font-bold tabular-nums ${textClass}`}
                              style={color ? { color } : undefined}
                            >
                              {formatDistance(primary.distanceKm, units)}
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
