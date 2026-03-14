import { OnboardingCard } from "../onboarding-card"
import type { OnboardingData } from "../types"

interface StepStrengthTrainingProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

export function StepStrengthTraining({ formData, onNext }: StepStrengthTrainingProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        Would you like to include strength training?
      </h2>
      <div className="space-y-3">
        <OnboardingCard
          label="Yes"
          selected={formData.strengthTraining === true}
          onClick={() => onNext({ strengthTraining: true })}
        />
        <OnboardingCard
          label="No"
          selected={formData.strengthTraining === false}
          onClick={() => onNext({ strengthTraining: false })}
        />
      </div>
    </div>
  )
}
