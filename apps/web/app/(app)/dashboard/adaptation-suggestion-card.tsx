"use client"

import { useState } from "react"
import { Zap } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { WorkoutDay } from "@workspace/ai"
import { WORKOUT_NAMES } from "@/app/plan/workout-utils"
import type { AdaptationSuggestion } from "./workout-feedback-sheet"

interface AdaptationSuggestionCardProps {
  suggestion: AdaptationSuggestion
  planId: string
  onAccepted: (updatedDays: WorkoutDay[]) => void
  onDismissed: () => void
}

export function AdaptationSuggestionCard({
  suggestion,
  planId,
  onAccepted,
  onDismissed,
}: AdaptationSuggestionCardProps) {
  const [loading, setLoading] = useState<"accept" | "dismiss" | null>(null)

  const original = suggestion.originalWorkout
  const proposed = suggestion.proposedWorkout

  async function handleAccept() {
    setLoading("accept")
    try {
      const res = await fetch(
        `/api/plans/${planId}/suggestions/${suggestion.id}/accept`,
        { method: "PATCH" },
      )
      if (res.ok) {
        const data = (await res.json()) as { plan: { days: WorkoutDay[] } }
        onAccepted(data.plan.days)
      }
    } finally {
      setLoading(null)
    }
  }

  async function handleDismiss() {
    setLoading("dismiss")
    try {
      const res = await fetch(
        `/api/plans/${planId}/suggestions/${suggestion.id}/dismiss`,
        { method: "PATCH" },
      )
      if (res.ok) onDismissed()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 border-l-[3px] border-l-amber-500 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Training adjustment suggested
          </p>
          <p className="text-xs text-amber-600/80 dark:text-amber-500/80">{suggestion.reason}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{WORKOUT_NAMES[original.type]}</span>
        <span aria-hidden="true">→</span>
        <span className="font-medium text-foreground">{WORKOUT_NAMES[proposed.type]}</span>
        {proposed.distanceKm != null && (
          <span className="text-xs text-muted-foreground">({proposed.distanceKm} km)</span>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={loading !== null}
          onClick={() => void handleAccept()}
        >
          {loading === "accept" ? "Updating…" : "Accept"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={loading !== null}
          onClick={() => void handleDismiss()}
        >
          Keep original
        </Button>
      </div>
    </div>
  )
}
