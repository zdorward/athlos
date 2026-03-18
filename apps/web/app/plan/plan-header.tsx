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
      <div className="relative flex items-center justify-between px-4 py-6">
        <Link
          href={backHref}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>

        {/* Centered plan info — absolutely positioned so it doesn't shift with left/right content */}
        <div className="absolute inset-x-0 flex flex-col items-center pointer-events-none">
          <h1 className="text-base font-semibold tracking-tight">{planName}</h1>
          {metaParts.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">{metaParts.join(" · ")}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
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
    </div>
  )
}
