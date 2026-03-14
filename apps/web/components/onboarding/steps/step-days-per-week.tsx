import { cn } from "@workspace/ui/lib/utils"
import type { OnboardingData } from "../types"

const OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const

interface StepDaysPerWeekProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

export function StepDaysPerWeek({ formData, onNext }: StepDaysPerWeekProps) {
  function handleSelect(n: 1 | 2 | 3 | 4 | 5 | 6 | 7) {
    onNext({ daysPerWeek: n })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        How many days per week would you like to run?
      </h2>
      <div className="flex gap-2">
        {OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => handleSelect(n)}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full text-sm font-medium border transition-all",
              formData.daysPerWeek === n
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
