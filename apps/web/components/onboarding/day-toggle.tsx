import { cn } from "@workspace/ui/lib/utils"
import type { Day } from "./types"

interface DayToggleProps {
  day: Day
  label: string
  selected: boolean
  onClick: () => void
  disabled: boolean
}

export function DayToggle({ label, selected, onClick, disabled }: DayToggleProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium border transition-all",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : disabled
          ? "opacity-40 cursor-not-allowed border-border"
          : "border-border hover:bg-muted"
      )}
    >
      {label}
    </button>
  )
}
