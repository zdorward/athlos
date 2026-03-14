import Link from "next/link"
import { format, parseISO } from "date-fns"
import type { WorkoutDay } from "@workspace/ai"
import {
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
} from "@/app/plan/workout-utils"

interface WeekListProps {
  days: WorkoutDay[]
  todayISO: string
  planId: string
  units: "km" | "miles"
}

/** Returns the ISO dates from day-after-tomorrow through Sunday of the current
 *  Mon–Sun week. Returns an empty array if today is Saturday or Sunday. */
function getThisWeekDates(todayISO: string): string[] {
  const today = new Date(todayISO + "T00:00:00") // parse as local midnight
  const dayOfWeek = today.getDay() // 0=Sun, 1=Mon … 6=Sat
  const daysUntilSunday = (7 - dayOfWeek) % 7 // 0 if today is Sunday

  const sunday = new Date(today)
  sunday.setDate(today.getDate() + daysUntilSunday)

  const startFrom = new Date(today)
  startFrom.setDate(today.getDate() + 2)

  if (startFrom > sunday) return [] // today is Sat or Sun

  const dates: string[] = []
  const cur = new Date(startFrom)
  while (cur <= sunday) {
    dates.push(cur.toLocaleDateString("en-CA"))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export function WeekList({ days, todayISO, planId, units }: WeekListProps) {
  const weekDates = getThisWeekDates(todayISO)
  if (weekDates.length === 0) return null

  // Build a lookup: date → entries
  const byDate = new Map<string, WorkoutDay[]>()
  for (const day of days) {
    const existing = byDate.get(day.date) ?? []
    existing.push(day)
    byDate.set(day.date, existing)
  }

  return (
    <section className="space-y-1">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1 pb-1">
        This Week
      </h2>
      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {weekDates.map((dateISO) => {
          const entries = (byDate.get(dateISO) ?? []).filter((e) => e.type !== "rest")
          const dayLabel = format(parseISO(dateISO), "EEE")

          if (entries.length === 0) {
            return (
              <Link
                key={dateISO}
                href={`/plan/${planId}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors opacity-50"
              >
                <span className="w-8 text-sm font-medium">{dayLabel}</span>
                <span className="text-xs text-muted-foreground">Rest</span>
              </Link>
            )
          }

          return entries.map((entry, i) => {
            const textClass = WORKOUT_TEXT_CLASS[entry.type]
            const inlineColor = getWorkoutColor(entry.type)
            return (
              <Link
                key={`${dateISO}-${i}`}
                href={`/plan/${planId}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <span className="w-8 text-sm font-medium">{dayLabel}</span>
                <span
                  className={`flex-1 text-sm ${textClass}`}
                  style={inlineColor ? { color: inlineColor } : undefined}
                >
                  {WORKOUT_NAMES[entry.type]}
                </span>
                {entry.distanceKm !== undefined && (
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {formatDistance(entry.distanceKm, units)} {distanceUnit(units)}
                  </span>
                )}
              </Link>
            )
          })
        })}
      </div>
    </section>
  )
}
