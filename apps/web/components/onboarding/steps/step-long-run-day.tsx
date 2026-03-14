import { ChevronLeft } from "lucide-react"
import { OnboardingCard } from "../onboarding-card"
import { DAY_LABELS, type Day, type OnboardingData } from "../types"

interface StepLongRunDayProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

export function StepLongRunDay({ formData, onNext, onBack }: StepLongRunDayProps) {
  const days = formData.selectedDays ?? []

  if (days.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Something went wrong — please go back</p>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        Which day would you like your long run?
      </h2>
      <div className="space-y-3">
        {days.map((day: Day) => (
          <OnboardingCard
            key={day}
            label={DAY_LABELS[day].full}
            selected={formData.longRunDay === day}
            onClick={() => onNext({ longRunDay: day })}
          />
        ))}
      </div>
    </div>
  )
}
