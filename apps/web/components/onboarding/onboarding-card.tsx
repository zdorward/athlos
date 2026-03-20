import { cn } from "@workspace/ui/lib/utils"

interface OnboardingCardProps {
  label: string
  description?: string
  badge?: string
  selected: boolean
  onClick: () => void
}

export function OnboardingCard({ label, description, badge, selected, onClick }: OnboardingCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full cursor-pointer rounded-xl border p-5 text-left transition-all",
        selected
          ? "ring-2 ring-primary bg-primary/5 border-primary/20"
          : "border-border bg-card hover:bg-muted/50"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium">{label}</div>
          {description && (
            <div className="mt-1 text-sm text-muted-foreground">{description}</div>
          )}
        </div>
        {badge && (
          <div className="shrink-0 text-xs text-muted-foreground">{badge}</div>
        )}
      </div>
    </button>
  )
}
