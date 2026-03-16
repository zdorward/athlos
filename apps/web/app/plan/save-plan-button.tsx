"use client"

import { Loader2, BookmarkPlus, CheckCircle2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

export interface SaveProps {
  status: "generating" | "complete" | "error"
  isSaving: boolean
  saveError: boolean
  onSave: () => void
  saved: boolean
}

interface SavePlanButtonProps extends SaveProps {
  className?: string
}

export function SavePlanButton({
  status,
  isSaving,
  saveError,
  onSave,
  saved,
  className,
}: SavePlanButtonProps) {
  if (status !== "complete") return null

  if (saved) {
    return (
      <Button asChild variant="outline" className={`gap-2 ${className ?? ""}`}>
        <a href="/dashboard">
          <CheckCircle2 className="h-4 w-4" />
          Plan saved — View dashboard →
        </a>
      </Button>
    )
  }

  if (isSaving) {
    return (
      <Button disabled className={`gap-2 ${className ?? ""}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Saving…
      </Button>
    )
  }

  return (
    <Button onClick={onSave} className={`gap-2 ${className ?? ""}`}>
      <BookmarkPlus className="h-4 w-4" />
      {saveError ? "Save failed — retry" : "Save Plan"}
    </Button>
  )
}
