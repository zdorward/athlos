import { OnboardingCard } from "../onboarding-card"
import type { Goal, OnboardingData } from "../types"

interface StepGoalProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

export function StepGoal({ formData, onNext }: StepGoalProps) {
  function handleSelect(goal: Goal) {
    onNext({ goal })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">What is your goal?</h2>
      <div className="space-y-3">
        <OnboardingCard
          label="Race"
          description="Train for a specific race event"
          selected={formData.goal === "race"}
          onClick={() => handleSelect("race")}
        />
        <OnboardingCard
          label="Build Aerobic Base"
          description="Improve your general fitness and endurance"
          selected={formData.goal === "aerobic_base"}
          onClick={() => handleSelect("aerobic_base")}
        />
      </div>
    </div>
  )
}
