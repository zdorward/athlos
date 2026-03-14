interface OnboardingProgressProps {
  currentStep: number
  totalSteps: number
}

export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  const fill = ((currentStep + 1) / totalSteps) * 100

  return (
    <div className="space-y-1.5">
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${fill}%` }}
        />
      </div>
      <p className="text-right text-xs text-muted-foreground">
        {currentStep + 1} / {totalSteps}
      </p>
    </div>
  )
}
