import { StepDayPicker } from "../step-day-picker"
import type { StepProps } from "../types"

export function StepStrengthDays({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  return (
    <StepDayPicker
      title="Which days would you like to do strength training?"
      initialDays={formData.strengthDays ?? []}
      onNext={(days) => onNext({ strengthDays: days })}
    />
  )
}
