"use client"

import { Check, Loader2, BookmarkPlus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

export interface SaveProps {
  status: "generating" | "complete" | "error"
  isSaving: boolean
  isSaved: boolean
  saveError: boolean
  onSave: () => void
}

interface SavePlanButtonProps extends SaveProps {
  className?: string
}

export function SavePlanButton({
  status,
  isSaving,
  isSaved,
  saveError,
  onSave,
  className,
}: SavePlanButtonProps) {
  if (status !== "complete") return null

  if (isSaved) {
    return (
      <Button variant="ghost" disabled className={`gap-2 text-primary ${className ?? ""}`}>
        <Check className="h-4 w-4" />
        Saved
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
