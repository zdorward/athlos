"use client"

import { useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { useDemoDispatch, useDemoState, type FeedbackValue } from "./use-demo-state"
import { Smile, Meh, Frown, AlertTriangle } from "lucide-react"

const feedbackOptions: { value: FeedbackValue; label: string; icon: typeof Smile }[] = [
  { value: "easy", label: "Easy", icon: Smile },
  { value: "moderate", label: "Moderate", icon: Meh },
  { value: "hard", label: "Hard", icon: Frown },
  { value: "very-hard", label: "Very Hard", icon: AlertTriangle },
]

interface FeedbackDialogProps {
  open: boolean
  onClose: () => void
}

export function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
  const dispatch = useDemoDispatch()
  const state = useDemoState()

  const handleFeedback = (value: FeedbackValue) => {
    dispatch({ type: "SUBMIT_FEEDBACK", payload: value })
  }

  // Auto-close dialog and transition after adapting phase
  useEffect(() => {
    if (state.demoPhase === "adapting") {
      const timer = setTimeout(() => {
        dispatch({ type: "FINISH_ADAPTING" })
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [state.demoPhase, dispatch])

  const isAdapting = state.demoPhase === "adapting"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isAdapting && onClose()}>
      <DialogContent showCloseButton={!isAdapting}>
        <DialogHeader>
          <DialogTitle>
            {isAdapting ? "Adapting your plan..." : "How did it feel?"}
          </DialogTitle>
          <DialogDescription>
            {isAdapting
              ? "Analyzing your feedback and adjusting tomorrow's workout."
              : "Your feedback helps us optimize your training."}
          </DialogDescription>
        </DialogHeader>

        {isAdapting ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">{state.adaptiveMessage}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {feedbackOptions.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant="outline"
                className="h-auto flex-col gap-2 py-4"
                onClick={() => handleFeedback(value)}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
