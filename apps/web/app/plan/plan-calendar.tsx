"use client"

import { format, parseISO } from "date-fns"
import { Star, Check } from "lucide-react"
import type { WorkoutDay, WorkoutType } from "@workspace/ai"
import { PlanDayDetail } from "./plan-day-detail"
import { SavePlanButton, SaveProps } from "./save-plan-button"
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

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

interface PlanCalendarProps {
  days: WorkoutDay[]
  units: "km" | "miles"
  totalWeeks: number
  raceDistance?: "5k" | "10k" | "half" | "full" | "ultra"
  saveProps?: SaveProps
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
}

export function PlanCalendar({ days, units, totalWeeks, raceDistance, saveProps, onToggleComplete, onSaveEdit, selectedKey, onSelectedKeyChange }: PlanCalendarProps) {
  // Derive the live WorkoutDay from the days prop so the detail panel always reflects current state
  const selectedDay = selectedKey
    ? (days.find((d) => d.date === selectedKey.date && d.type === selectedKey.type) ?? null)
    : null
  const weeks = groupDaysByWeek(days)
  const taperWeeks = getTaperWeeks(raceDistance)
  const unit = distanceUnit(units)

  if (weeks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-subtle-foreground">
        Generating your plan…
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-200px)]">
      {/* Calendar scroll area */}
      <div className="flex-1 overflow-auto">
        {/* Day of week header */}
        <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 mb-1 sticky top-0 bg-background z-10 px-4 pt-4 pb-2">
          <div />
          {DAY_ORDER.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="px-4 pb-4">
        {weeks.map((weekDays, weekIdx) => {
          if (!weekDays) return null
          const weekNum = weekIdx + 1
          const phase = totalWeeks > 0 ? getPhaseLabel(weekNum, totalWeeks, taperWeeks) : ""

          // Build a map of day-of-week → WorkoutDay[] for this week (multiple entries per day allowed)
          const dayMap: Record<string, WorkoutDay[]> = {}
          for (const day of weekDays) {
            const dow = format(parseISO(day.date), "EEE") // "Mon", "Tue", etc.
            if (!dayMap[dow]) dayMap[dow] = []
            dayMap[dow]!.push(day)
          }

          const weeklyKm = weekDays.reduce((sum, d) => sum + (d.distanceKm ?? 0), 0)

          return (
            <div key={weekIdx} className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 mb-1">
              {/* Week label column */}
              <div className="flex flex-col justify-center pr-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle-foreground">
                  W{weekNum}
                </p>
                {phase && (
                  <p className="text-[9px] text-muted-foreground">{phase}</p>
                )}
                {weeklyKm > 0 && (
                  <p className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {formatDistance(weeklyKm, units)}{unit}
                  </p>
                )}
              </div>

              {/* 7 day cells */}
              {DAY_ORDER.map((dow) => {
                const entries = dayMap[dow]
                if (!entries?.length) {
                  // Day not in plan yet (still streaming) — empty placeholder
                  return (
                    <div
                      key={dow}
                      className="min-h-[72px] rounded-md border border-border bg-card opacity-20"
                    />
                  )
                }

                // Primary entry for selection: prefer run types over strength/rest
                const RUN_TYPES = new Set(["easy", "long", "tempo", "intervals", "race"])
                const primary = entries.find((d) => RUN_TYPES.has(d.type)) ?? entries[0]!
                const isRace = entries.some((d) => d.type === "race")
                const isRest = entries.every((d) => d.type === "rest")
                const isSelected = selectedDay?.date === primary.date && selectedDay?.type === primary.type
                const isFullyComplete = !isRest && entries.filter((e) => e.type !== "rest").every((e) => e.completed === true)

                return (
                  <button
                    key={dow}
                    onClick={() => onSelectedKeyChange(isSelected ? null : { date: primary.date, type: primary.type })}
                    className={[
                      "min-h-[72px] rounded-md border p-2 text-left transition-colors cursor-pointer",
                      isRace
                        ? "bg-primary/12 border-primary"
                        : isFullyComplete && isSelected
                        ? "bg-green-500/10 border-green-500/50"
                        : isFullyComplete
                        ? "bg-green-500/10 border-green-500/30"
                        : isSelected
                        ? "bg-muted border-primary/40"
                        : "bg-card border-border hover:border-primary/25",
                      isRest ? "opacity-40" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-subtle-foreground">
                        {format(parseISO(primary.date), "d")}
                      </p>
                      {isFullyComplete && (
                        <Check className="h-3 w-3 text-green-600" />
                      )}
                    </div>

                    {isRace && (
                      <Star className="h-3 w-3 fill-primary text-primary mb-1" />
                    )}

                    {entries.map((entry) => {
                      const color = getWorkoutColor(entry.type)
                      const textClass = WORKOUT_TEXT_CLASS[entry.type]
                      return (
                        <div key={entry.type}>
                          {entry.distanceKm != null && (
                            <p
                              className={`text-sm font-bold tabular-nums ${textClass}`}
                              style={color ? { color } : undefined}
                            >
                              {formatDistance(entry.distanceKm, units)}
                              <span className="text-[9px] font-normal ml-0.5 text-muted-foreground">
                                {unit}
                              </span>
                            </p>
                          )}
                          <p
                            className={`text-[10px] mt-0.5 ${textClass}`}
                            style={color ? { color } : undefined}
                          >
                            {WORKOUT_NAMES[entry.type]}
                          </p>
                        </div>
                      )
                    })}
                  </button>
                )
              })}
            </div>
          )
        })}
        {saveProps && (
          <div className="pt-4 pb-4">
            <SavePlanButton
              status={saveProps.status}
              isSaving={saveProps.isSaving}
              saveError={saveProps.saveError}
              onSave={saveProps.onSave}
              className="w-full"
            />
          </div>
        )}
        </div>
      </div>

      {/* Detail side panel */}
      <div className="w-72 border-l border-border bg-card overflow-y-auto flex-shrink-0">
        <PlanDayDetail day={selectedDay} units={units} onToggleComplete={onToggleComplete} onSaveEdit={onSaveEdit} />
      </div>
    </div>
  )
}
