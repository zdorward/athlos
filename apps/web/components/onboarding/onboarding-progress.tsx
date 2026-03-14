interface OnboardingProgressProps {
  currentStep: number
  totalSteps: number
}

export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  const fill = ((currentStep + 1) / totalSteps) * 100

  return (
    <div className="w-full space-y-2">
      <p className="text-sm text-muted-foreground">
        Step {currentStep + 1} of {totalSteps}
      </p>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${fill}%` }}
        />
      </div>
    </div>
  )
}
