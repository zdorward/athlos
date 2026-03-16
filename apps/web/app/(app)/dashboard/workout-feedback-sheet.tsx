"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Button } from "@workspace/ui/components/button"
import type { WorkoutDay } from "@workspace/ai"

type ActualEffort = "hard" | "good" | "easy"
type Soreness = "none" | "mild" | "significant"

interface WorkoutFeedbackSheetProps {
  open: boolean
  entry: WorkoutDay | null
  planId: string
  onLogged: (suggestion: AdaptationSuggestion | null) => void
  onDismiss: () => void
}

export interface AdaptationSuggestion {
  id: string
  planId: string
  status: "pending" | "accepted" | "dismissed"
  reason: string
  targetDate: string
  originalWorkout: WorkoutDay
  proposedWorkout: WorkoutDay
  createdAt: string
  resolvedAt: string | null
}

const EFFORT_OPTIONS: { value: ActualEffort; emoji: string; label: string }[] = [
  { value: "hard", emoji: "😓", label: "Hard" },
  { value: "good", emoji: "😊", label: "Good" },
  { value: "easy", emoji: "⚡", label: "Easy" },
]

const SORENESS_OPTIONS: { value: Soreness; emoji: string; label: string }[] = [
  { value: "none", emoji: "🟢", label: "Fresh" },
  { value: "mild", emoji: "🟡", label: "Mild soreness" },
  { value: "significant", emoji: "🔴", label: "Pretty beat up" },
]

export function WorkoutFeedbackSheet({
  open,
  entry,
  planId,
  onLogged,
  onDismiss,
}: WorkoutFeedbackSheetProps) {
  const [effort, setEffort] = useState<ActualEffort | null>(null)
  const [soreness, setSoreness] = useState<Soreness | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setEffort(null)
      setSoreness(null)
      setSubmitError(false)
      onDismiss()
    }
  }

  async function handleSubmit() {
    if (!entry || !effort || !soreness) return
    setSubmitting(true)
    setSubmitError(false)
    try {
      const res = await fetch(
        `/api/plans/${planId}/workouts/${entry.date}/log`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workoutType: entry.type,
            actualEffort: effort,
            completed: true,
            soreness,
          }),
        },
      )
      if (res.ok) {
        const data = (await res.json()) as { suggestion: AdaptationSuggestion | null }
        setEffort(null)
        setSoreness(null)
        onLogged(data.suggestion)
      } else {
        setSubmitError(true)
      }
    } catch {
      setSubmitError(true)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = effort !== null && soreness !== null && !submitting

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-left">How did it go?</SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Effort */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">How did it feel?</p>
            <div className="grid grid-cols-3 gap-2">
              {EFFORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEffort(opt.value)}
                  className={[
                    "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors cursor-pointer",
                    effort === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-muted/50",
                  ].join(" ")}
                >
                  <span className="text-2xl leading-none" aria-hidden="true">{opt.emoji}</span>
                  <span className="text-xs font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Soreness */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">How are your legs going into today?</p>
            <div className="grid grid-cols-3 gap-2">
              {SORENESS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSoreness(opt.value)}
                  className={[
                    "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors cursor-pointer",
                    soreness === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-muted/50",
                  ].join(" ")}
                >
                  <span className="text-2xl leading-none" aria-hidden="true">{opt.emoji}</span>
                  <span className="text-[11px] font-semibold text-center leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {submitError && (
            <p className="text-xs text-destructive text-center">
              Something went wrong. Please try again.
            </p>
          )}

          <Button
            className="w-full"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
