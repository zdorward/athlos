"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft } from "lucide-react"
import { OnboardingProgress } from "./onboarding-progress"
import { FinalScreen } from "./final-screen"
import { StepGoal } from "./steps/step-goal"
import { StepFindRace } from "./steps/step-find-race"
import { StepDaysPerWeek } from "./steps/step-days-per-week"
import { StepWhichDays } from "./steps/step-which-days"
import { StepLongRunDay } from "./steps/step-long-run-day"
import { StepUnits } from "./steps/step-units"
import { StepStrengthTraining } from "./steps/step-strength-training"
import { getSteps, type OnboardingData } from "./types"

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -60 : 60, opacity: 0 }),
}

export function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [formData, setFormData] = useState<OnboardingData>({})

  const steps = getSteps(formData.goal)
  const isComplete = currentStep >= steps.length

  function advance() {
    setDirection(1)
    setCurrentStep((s) => s + 1)
  }

  function goBack() {
    setDirection(-1)
    setCurrentStep((s) => s - 1)
  }

  function handleNext(data: Partial<OnboardingData>) {
    let merged: OnboardingData = { ...formData, ...data }

    // Goal change: clear race data
    if ("goal" in data && data.goal !== formData.goal) {
      merged = { ...merged, race: undefined }
    }

    // daysPerWeek change: clear downstream day selections
    if ("daysPerWeek" in data && data.daysPerWeek !== formData.daysPerWeek) {
      merged = { ...merged, selectedDays: [], longRunDay: undefined }
    }

    // selectedDays change: clear longRunDay if it's no longer in the new selection
    if ("selectedDays" in data) {
      const newDays = data.selectedDays ?? []
      if (merged.longRunDay && !newDays.includes(merged.longRunDay)) {
        merged = { ...merged, longRunDay: undefined }
      }
    }

    setFormData(merged)
    advance()
  }

  const stepKey = isComplete ? "final" : steps[currentStep]
  const stepProps = { formData, onNext: handleNext, onBack: goBack }

  function renderStep() {
    if (isComplete) return <FinalScreen formData={formData} />
    const stepName = steps[currentStep]
    switch (stepName) {
      case "goal":        return <StepGoal {...stepProps} />
      case "findRace":    return <StepFindRace {...stepProps} />
      case "daysPerWeek": return <StepDaysPerWeek {...stepProps} />
      case "whichDays":   return <StepWhichDays {...stepProps} />
      case "longRunDay":  return <StepLongRunDay {...stepProps} />
      case "units":       return <StepUnits {...stepProps} />
      case "strength":    return <StepStrengthTraining {...stepProps} />
      default:            return null
    }
  }

  return (
    <div className="relative mx-auto max-w-md px-4 py-12">
      {currentStep > 0 && !isComplete && (
        <button
          onClick={goBack}
          className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      )}

      {!isComplete && (
        <div className="mb-8">
          <OnboardingProgress currentStep={currentStep} totalSteps={steps.length} />
        </div>
      )}

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={stepKey}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
