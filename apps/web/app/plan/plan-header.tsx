"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { formatDistance, distanceUnit } from "./workout-utils"
import { SavePlanButton, type SaveProps } from "./save-plan-button"

interface PlanHeaderProps {
  planName: string
  totalWeeks: number
  totalKm: number
  units: "km" | "miles"
  status: "generating" | "complete" | "error" | "rate-limited"
  generatingWeek?: number
  goalTimeLabel?: string
  backHref?: string
  saveProps?: SaveProps
  onNewPlan?: () => void
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
  saveProps,
  onNewPlan,
}: PlanHeaderProps) {
  const totalDisplay = formatDistance(totalKm, units)
  const unit = distanceUnit(units)

  const metaParts = [
    totalWeeks > 0 ? `${totalWeeks} weeks` : null,
    totalKm > 0 ? `${totalDisplay} ${unit}` : null,
    goalTimeLabel ? `Goal ${goalTimeLabel}` : null,
  ].filter(Boolean)

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

        <div className="flex items-center gap-3">
          {status === "generating" && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <p className="text-xs text-muted-foreground">
                Week {generatingWeek}{totalWeeks > 0 ? ` of ${totalWeeks}` : ""}
              </p>
            </div>
          )}

          {status === "error" && (
            <p className="text-xs text-destructive">Generation failed — go back and try again.</p>
          )}

          {status === "rate-limited" && (
            <p className="text-xs text-destructive">Too many plans generated today — try again tomorrow.</p>
          )}

          {saveProps && <SavePlanButton {...saveProps} />}

          {onNewPlan && (
            <button
              onClick={onNewPlan}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              New plan
            </button>
          )}
        </div>
      </div>

      {/* Centered plan info */}
      <div className="text-center px-4 pb-4 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{planName}</h1>
        {metaParts.length > 0 && (
          <p className="text-sm text-muted-foreground">{metaParts.join(" · ")}</p>
        )}
      </div>
    </div>
  )
}
