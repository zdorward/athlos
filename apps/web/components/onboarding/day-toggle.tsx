import { cn } from "@workspace/ui/lib/utils"
import type { Day } from "./types"

interface DayToggleProps {
  day: Day
  label: string
  selected: boolean
  onClick: () => void
  disabled?: boolean
}

export function DayToggle({ label, selected, onClick, disabled }: DayToggleProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-sm font-medium border transition-all active:scale-90 active:duration-100",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : disabled
          ? "cursor-not-allowed opacity-40 border-border"
          : "border-border hover:bg-muted"
      )}
    >
      {label}
    </button>
  )
}
