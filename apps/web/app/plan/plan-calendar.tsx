"use client"

import { format, parseISO } from "date-fns"
import { Star, Check } from "lucide-react"
import type { WorkoutDay, WorkoutType, PhaseEntry } from "@workspace/plan-engine"
import { PlanDayDetail } from "./plan-day-detail"
import {
  groupDaysByWeek,
  groupDaysByDate,
  getPhaseLabel,
  getTaperWeeks,
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
  RUN_TYPES,
} from "./workout-utils"

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function getTodayISO(): string {
  return new Date().toLocaleDateString("en-CA")
}

/** Returns the ISO date of the Monday of the week containing `isoDate`. */
function getMondayOfWeek(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00")
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toLocaleDateString("en-CA")
}

/** Returns ISO dates for all 7 days of the week starting from `mondayISO`. */
function getWeekDates(mondayISO: string): string[] {
  const dates: string[] = []
  const d = new Date(mondayISO + "T00:00:00")
  for (let i = 0; i < 7; i++) {
    dates.push(d.toLocaleDateString("en-CA"))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

interface PlanCalendarProps {
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

export function PlanCalendar({ days, units, totalWeeks, raceDistance, planStartDate, onToggleComplete, onSaveEdit, selectedKey, onSelectedKeyChange, phases, isNewlyGenerated }: PlanCalendarProps) {
  // Derive the live WorkoutDay from the days prop so the detail panel always reflects current state
  const selectedDay = selectedKey
    ? (days.find((d) => d.date === selectedKey.date && d.type === selectedKey.type) ?? null)
    : null
  // Filter out bridge days (pre-plan gap runs) before grouping — they shift startMs and
  // misalign the 7-day windows with the scheduler's Monday-based weeks
  const planFirstMonday = planStartDate ?? days[0]?.date ?? null
  const planDays = planFirstMonday ? days.filter(d => d.date >= planFirstMonday) : days
  const weeks = groupDaysByWeek(planDays)
  const taperWeeks = getTaperWeeks(raceDistance)
  const unit = distanceUnit(units)
  const todayISO = getTodayISO()
  const currentWeekMonday = getMondayOfWeek(todayISO)
  const showPrePlanWeek = planFirstMonday !== null && currentWeekMonday < planFirstMonday
  const prePlanDates = showPrePlanWeek ? getWeekDates(currentWeekMonday) : []
  // First plan week's phase label — shown above the "Now" row
  const firstPhase = totalWeeks > 0 ? getPhaseLabel(1, totalWeeks, taperWeeks, phases) : ""
  // Bridge days grouped by date (supports multiple entries per day, e.g. run + strength)
  const bridgeDayMap = groupDaysByDate(
    days.filter(d => planFirstMonday && d.date < planFirstMonday)
  )

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
              className="text-center text-[10px] font-semibold uppercase tracking-widest text-subtle-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="px-4 pb-4">
        {/* Pre-plan current week — shown when plan hasn't started yet */}
        {showPrePlanWeek && (
          <>
            {firstPhase && (
              <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 mb-1 mt-3">
                <div />
                <div className="col-span-7 flex items-center gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground whitespace-nowrap">
                    {firstPhase}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 mb-1">
            <div className="flex flex-col justify-center pr-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-subtle-foreground opacity-40">
                Now
              </p>
            </div>
            {prePlanDates.map((dateISO) => {
              const isToday = dateISO === todayISO
              const isPast = dateISO < todayISO
              // Task 2 will replace this entire callback with full multi-entry rendering
              const bridgeDay = bridgeDayMap.get(dateISO)?.[0]
              const isRest = !bridgeDay || bridgeDay.type === "rest"
              const isSelected = selectedDay?.date === dateISO && selectedDay?.type === bridgeDay?.type

              if (isRest) {
                return (
                  <div
                    key={dateISO}
                    className={[
                      "min-h-[88px] rounded-md border p-2",
                      isPast
                        ? "bg-muted/10 border-border/20 opacity-25"
                        : "bg-muted/30 border-border/40",
                    ].join(" ")}
                  >
                    <p className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-subtle-foreground"}`}>
                      {format(parseISO(dateISO), "d")}
                    </p>
                    {isToday && (
                      <div className="w-1 h-1 rounded-full bg-primary mt-1" />
                    )}
                  </div>
                )
              }

              const color = getWorkoutColor(bridgeDay.type)
              const textClass = WORKOUT_TEXT_CLASS[bridgeDay.type]
              return (
                <button
                  key={dateISO}
                  onClick={() => onSelectedKeyChange(isSelected ? null : { date: bridgeDay.date, type: bridgeDay.type })}
                  className={[
                    "min-h-[88px] rounded-md border p-2 text-left transition-colors cursor-pointer",
                    isSelected
                      ? "bg-muted border-primary/40"
                      : "bg-card border-border hover:border-primary/25",
                  ].join(" ")}
                >
                  <p className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-subtle-foreground"}`}>
                    {format(parseISO(dateISO), "d")}
                  </p>
                  {bridgeDay.distanceKm != null && (
                    <p
                      className={`text-sm font-bold tabular-nums ${textClass}`}
                      style={color ? { color } : undefined}
                    >
                      {formatDistance(bridgeDay.distanceKm, units)}
                      <span className="text-[9px] font-normal ml-0.5 text-muted-foreground">{unit}</span>
                    </p>
                  )}
                  <p
                    className={`text-[10px] mt-0.5 ${textClass}`}
                    style={color ? { color } : undefined}
                  >
                    {WORKOUT_NAMES[bridgeDay.type]}
                  </p>
                </button>
              )
            })}
            </div>
          </>
        )}
        {weeks.map((weekDays, weekIdx) => {
          if (!weekDays) return null
          const weekNum = weekIdx + 1
          const phase = totalWeeks > 0 ? getPhaseLabel(weekNum, totalWeeks, taperWeeks, phases) : ""
          const prevPhase = totalWeeks > 0 && weekIdx > 0
            ? getPhaseLabel(weekIdx, totalWeeks, taperWeeks, phases)
            : null
          const showPhaseHeader = phase && phase !== prevPhase

          // Build a map of day-of-week → WorkoutDay[] for this week (multiple entries per day allowed)
          const dayMap: Record<string, WorkoutDay[]> = {}
          for (const day of weekDays) {
            const dow = format(parseISO(day.date), "EEE") // "Mon", "Tue", etc.
            if (!dayMap[dow]) dayMap[dow] = []
            dayMap[dow]!.push(day)
          }

          const weeklyKm = weekDays.reduce((sum, d) => sum + (d.distanceKm ?? 0), 0)

          return (
            <div
              key={weekIdx}
              className={isNewlyGenerated ? "animate-fade-in" : undefined}
              style={isNewlyGenerated ? {
                animationDelay: `${weekIdx * 30}ms`,
                animationFillMode: "both",
              } : undefined}
            >
              {showPhaseHeader && (
                <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 mb-1 mt-3">
                  <div />
                  <div className="col-span-7 flex items-center gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground whitespace-nowrap">
                      {phase}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                </div>
              )}
            <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 mb-1">
              {/* Week label column */}
              <div className="flex flex-col justify-center pr-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-subtle-foreground">
                  W{weekNum}
                </p>
                {weekDays[0] && (
                  <p className="text-[10px] text-subtle-foreground/60 tabular-nums mt-0.5">
                    {format(parseISO(weekDays[0].date), "MMM d")}
                  </p>
                )}
                {weeklyKm > 0 && (
                  <p className="text-[10px] font-semibold tabular-nums text-muted-foreground mt-0.5">
                    {formatDistance(weeklyKm, units)}{unit}
                  </p>
                )}
              </div>

              {/* 7 day cells */}
              {DAY_ORDER.map((dow) => {
                const entries = dayMap[dow]
                if (!entries?.length) {
                  // Defensive fallback: day missing from plan data
                  return (
                    <div
                      key={dow}
                      className="min-h-[88px] rounded-md border border-border bg-card p-2 opacity-40"
                    >
                      <p className="text-[10px] text-subtle-foreground">—</p>
                      <p className="text-[10px] text-subtle-foreground mt-0.5">Rest Day</p>
                    </div>
                  )
                }

                // Primary entry for selection: prefer run types over strength/rest
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
                      "min-h-[88px] rounded-md border p-2 text-left transition-colors cursor-pointer",
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

                    {(() => {
                      const secondaryEntries = entries.filter(
                        (e) => e.type !== primary.type && e.type !== "rest"
                      )
                      const primColor = getWorkoutColor(primary.type)
                      const primTextClass = WORKOUT_TEXT_CLASS[primary.type]
                      return (
                        <>
                          <p
                            className={`text-[10px] font-semibold leading-snug ${primTextClass}`}
                            style={primColor ? { color: primColor } : undefined}
                          >
                            {primary.distanceKm != null && (
                              <>
                                <span className="text-sm font-bold tabular-nums">
                                  {formatDistance(primary.distanceKm, units)}
                                </span>
                                <span className="text-[9px] font-normal text-muted-foreground ml-0.5">
                                  {unit}
                                </span>
                                {" · "}
                              </>
                            )}
                            {WORKOUT_NAMES[primary.type]}
                          </p>
                          {secondaryEntries.map((entry) => {
                            const secColor = getWorkoutColor(entry.type)
                            const secTextClass = WORKOUT_TEXT_CLASS[entry.type]
                            return (
                              <p
                                key={`${entry.date}-${entry.type}`}
                                className={`text-[10px] mt-0.5 font-medium ${secTextClass}`}
                                style={secColor ? { color: secColor } : undefined}
                              >
                                {WORKOUT_NAMES[entry.type]}
                              </p>
                            )
                          })}
                        </>
                      )
                    })()}
                  </button>
                )
              })}
            </div>
            </div>
          )
        })}
        </div>
      </div>

      {/* Detail side panel */}
      <div className="w-72 border-l border-border bg-card overflow-y-auto shrink-0">
        <PlanDayDetail day={selectedDay} units={units} onToggleComplete={onToggleComplete} onSaveEdit={onSaveEdit} />
      </div>
    </div>
  )
}
