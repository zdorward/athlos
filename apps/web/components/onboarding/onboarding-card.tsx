import { cn } from "@workspace/ui/lib/utils"

interface OnboardingCardProps {
  label: string
  description?: string
  selected: boolean
  onClick: () => void
}

export function OnboardingCard({ label, description, selected, onClick }: OnboardingCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-all",
        selected
          ? "ring-2 ring-primary bg-primary/5 border-primary/20"
          : "border-border bg-card hover:bg-muted/50"
      )}
    >
      <div className="font-medium">{label}</div>
      {description && (
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      )}
    </button>
  )
}
