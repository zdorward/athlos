import { OnboardingCard } from "../onboarding-card"
import type { OnboardingData } from "../types"

interface StepUnitsProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

export function StepUnits({ formData, onNext }: StepUnitsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Do you prefer km or miles?</h2>
      <div className="space-y-3">
        <OnboardingCard
          label="km"
          selected={formData.units === "km"}
          onClick={() => onNext({ units: "km" })}
        />
        <OnboardingCard
          label="miles"
          selected={formData.units === "miles"}
          onClick={() => onNext({ units: "miles" })}
        />
      </div>
    </div>
  )
}
