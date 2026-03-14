"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, X } from "lucide-react"
import { OnboardingProgress } from "./onboarding-progress"
import { FinalScreen } from "./final-screen"
import { StepFindRace } from "./steps/step-find-race"
import { StepWhichDays } from "./steps/step-which-days"
import { StepLongRunDay } from "./steps/step-long-run-day"
import { StepUnits } from "./steps/step-units"
import { StepStrengthTraining } from "./steps/step-strength-training"
import { StepStrengthDays } from "./steps/step-strength-days"
import { StepTimeGoal } from "./steps/step-time-goal"
import { StepGoalTime } from "./steps/step-goal-time"
import { getSteps, type OnboardingData } from "./types"

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -60 : 60, opacity: 0 }),
}

interface OnboardingFlowProps {
  onExit: () => void
  initialData?: Partial<OnboardingData>
}

export function OnboardingFlow({ onExit, initialData }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [formData, setFormData] = useState<OnboardingData>(initialData ?? {})

  const steps = getSteps(formData.timeGoal, formData.strengthTraining, !!formData.race)
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

    // timeGoal change to false: clear goal time
    if ("timeGoal" in data && data.timeGoal === false) {
      merged = { ...merged, goalTime: undefined }
    }

    // strengthTraining change to false: clear strength days
    if ("strengthTraining" in data && data.strengthTraining === false) {
      merged = { ...merged, strengthDays: undefined }
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
      case "findRace":  return <StepFindRace {...stepProps} initialMode={formData.manualRaceEntry ? "manual" : "search"} />
      case "timeGoal":  return <StepTimeGoal {...stepProps} />
      case "goalTime":  return <StepGoalTime {...stepProps} />
      case "whichDays": return <StepWhichDays {...stepProps} />
      case "longRunDay":    return <StepLongRunDay {...stepProps} />
      case "units":         return <StepUnits {...stepProps} />
      case "strength":      return <StepStrengthTraining {...stepProps} />
      case "strengthDays":  return <StepStrengthDays {...stepProps} />
      default:              return null
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex items-center gap-4">
        {currentStep > 0 ? (
          <button
            onClick={goBack}
            aria-label="Go back"
            className="flex shrink-0 cursor-pointer items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <div className="shrink-0 w-5" />
        )}

        <div className="flex-1 px-4">
          <OnboardingProgress currentStep={currentStep} totalSteps={steps.length} />
        </div>

        <button
          onClick={onExit}
          className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Exit"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

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
