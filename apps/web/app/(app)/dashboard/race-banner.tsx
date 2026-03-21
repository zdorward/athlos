// apps/web/app/dashboard/race-banner.tsx
import { differenceInCalendarDays, parseISO, format } from "date-fns"
import type { PlanGenerationInput, WorkoutDay, PhaseEntry } from "@workspace/plan-engine"
import { getPhaseLabel, getTaperWeeks } from "@/app/plan/workout-utils"

interface RaceBannerProps {
  input: PlanGenerationInput
  days: WorkoutDay[]
  totalWeeks: number
  phases?: PhaseEntry[]
}

function getPlanWeekNum(days: WorkoutDay[], todayISO: string): number {
  if (days.length === 0) return 1
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const firstDate = sorted[0]!.date
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const elapsed = new Date(todayISO).getTime() - new Date(firstDate).getTime()
  return Math.max(1, Math.floor(elapsed / msPerWeek) + 1)
}

export function RaceBanner({ input, days, totalWeeks, phases }: RaceBannerProps) {
  const todayISO = new Date().toLocaleDateString("en-CA")
  const raceDate = parseISO(input.race.date)
  const daysAway = differenceInCalendarDays(raceDate, parseISO(todayISO))

  if (daysAway < 0) return null  // race has passed — hide banner

  const weekNum = getPlanWeekNum(days, todayISO)
  const taperWeeks = getTaperWeeks(input.race.distance as "half" | "full")
  const phase = totalWeeks > 0 ? getPhaseLabel(weekNum, totalWeeks, taperWeeks, phases) : ""
  const progressPct = totalWeeks > 0 ? Math.min(100, Math.round((weekNum / totalWeeks) * 100)) : 0
  const raceDateLabel = format(raceDate, "MMM d, yyyy")

  return (
    <div
      className="rounded-xl p-4 text-white"
      style={{ background: "linear-gradient(135deg, var(--primary) 0%, #8b5cf6 100%)" }}
    >
      {/* Race name + date */}
      <p className="text-[11px] font-bold uppercase tracking-widest opacity-75 mb-1">
        {input.race.name} · {raceDateLabel}
      </p>

      {/* Days away + projected time */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <span className="text-3xl font-extrabold leading-none">{daysAway}</span>
          <span className="text-sm opacity-80 ml-1.5">days away</span>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest opacity-60 mb-0.5">Proj. finish</p>
          <p className="text-sm font-bold opacity-40">Coming soon</p>
        </div>
      </div>

      {/* Progress bar */}
      {totalWeeks > 0 && (
        <>
          <div className="h-1 rounded-full bg-white/20 mb-1.5">
            <div
              className="h-1 rounded-full bg-white transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[10px] opacity-65">
            Week {weekNum} of {totalWeeks}{phase ? ` · ${phase}` : ""}
          </p>
        </>
      )}
    </div>
  )
}
