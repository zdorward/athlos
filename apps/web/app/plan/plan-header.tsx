"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { formatDistance, distanceUnit } from "./workout-utils"
interface PlanHeaderProps {
  planName: string
  totalWeeks: number
  totalKm: number
  units: "km" | "miles"
  status: "generating" | "complete" | "error"
  generatingWeek?: number
  goalTimeLabel?: string
  backHref?: string
}

export function PlanHeader({
  planName,
  totalWeeks,
  totalKm,
  units,
  status,
  generatingWeek,
  goalTimeLabel,
  backHref = "/",
}: PlanHeaderProps) {
  const totalDisplay = formatDistance(totalKm, units)
  const unit = distanceUnit(units)

  return (
    <div className="border-b border-border">
      {/* Nav row */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          href={backHref}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>

        {goalTimeLabel && (
          <span className="rounded-sm border border-primary/20 bg-primary/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
            Goal {goalTimeLabel}
          </span>
        )}
      </div>

      {/* Plan info row */}
      <div className="px-4 pb-4 space-y-3">
        <h1 className="text-xl font-semibold tracking-tight truncate">{planName}</h1>

        <div className="flex items-center gap-6">
          <div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
              {totalWeeks > 0 ? totalWeeks : "—"}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
              Weeks
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-primary">
              {totalKm > 0 ? totalDisplay : "—"}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
              Total {unit}
            </p>
          </div>
        </div>

        {status === "generating" && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <p className="text-xs text-muted-foreground">
              Generating week {generatingWeek}
              {totalWeeks > 0 ? ` of ${totalWeeks}` : ""}…
            </p>
          </div>
        )}

        {status === "error" && (
          <p className="text-xs text-destructive">
            Generation failed — please go back and try again.
          </p>
        )}
      </div>
    </div>
  )
}
