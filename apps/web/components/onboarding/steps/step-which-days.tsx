import { StepDayPicker } from "../step-day-picker"
import type { StepProps } from "../types"

export function StepWhichDays({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  return (
    <StepDayPicker
      title="Which days are you free to run?"
      initialDays={formData.selectedDays ?? []}
      onNext={(days) => onNext({ selectedDays: days })}
    />
  )
}
