"use client"

import { useEffect, useState } from "react"
import { Wordmark } from "@/components/wordmark"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, X, Check } from "lucide-react"
import { format } from "date-fns"
import { OnboardingProgress } from "./onboarding-progress"
import { FinalScreen } from "./final-screen"
import { StepFindRace } from "./steps/step-find-race"
import { StepWhichDays } from "./steps/step-which-days"
import { StepStrength } from "./steps/step-strength"
import { StepGoalTime } from "./steps/step-goal-time"
import { StepWeeklyMileage } from "./steps/step-weekly-mileage"
import { getSteps, type OnboardingData, type RaceData } from "./types"
import { authClient } from "@/lib/auth-client"
import { detectUnits, formatRaceDistance } from "@/lib/units"

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -60 : 60, opacity: 0 }),
}

const DRAFT_KEY = "athlos_onboarding_draft"

const STEP_LABELS: Record<string, string> = {
  findRace: "Your race",
  goalTime: "Goal time",
  whichDays: "Running days",
  weeklyMileage: "Weekly mileage",
  strength: "Strength training",
}

interface OnboardingFlowProps {
  onExit: () => void
  initialData?: Partial<OnboardingData>
}

function LeftPanel({
  race,
  steps,
  currentStep,
  isComplete,
  units,
}: {
  race?: RaceData
  steps: readonly string[]
  currentStep: number
  isComplete: boolean
  units: "km" | "miles"
}) {
  return (
    <div
      className="hidden md:flex md:w-[360px] lg:w-[420px] shrink-0 flex-col relative overflow-hidden"
      style={{
        background: "#020208",
        borderRight: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Aurora blobs */}
      <div
        style={{
          position: "absolute",
          width: "130%",
          height: "55%",
          top: "-20%",
          left: "-25%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(30,55,200,0.22) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "110%",
          height: "45%",
          bottom: "-15%",
          right: "-20%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(15,80,180,0.18) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      {/* Dot grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(80,100,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(80,100,255,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div className="relative flex flex-col h-full p-10 justify-between">
        {/* Wordmark */}
        <Wordmark className="text-white/60" />

        {/* Race info */}
        {race && (
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.1em",
                color: "rgba(100,140,255,0.7)",
                textTransform: "uppercase",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              {formatRaceDistance(race.distance, units)}
            </div>
            <h2
              style={{
                fontSize: "clamp(20px, 2vw, 26px)",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
                margin: 0,
                marginBottom: 8,
              }}
            >
              {race.name}
            </h2>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
              {format(race.date, "MMMM d, yyyy")}
            </div>
          </div>
        )}

        {/* Step list */}
        <div className="space-y-3.5">
          {steps.map((step, i) => {
            const isPast = i < currentStep || isComplete
            const isCurrent = i === currentStep && !isComplete
            return (
              <div key={step} className="flex items-center gap-3">
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isPast
                      ? "rgba(80,120,255,0.85)"
                      : isCurrent
                      ? "rgba(255,255,255,0.1)"
                      : "transparent",
                    border: isPast
                      ? "none"
                      : isCurrent
                      ? "1.5px solid rgba(255,255,255,0.45)"
                      : "1.5px solid rgba(255,255,255,0.12)",
                    transition: "all 0.3s ease",
                  }}
                >
                  {isPast && (
                    <Check
                      style={{ width: 11, height: 11, color: "#fff", strokeWidth: 3 }}
                    />
                  )}
                  {isCurrent && (
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.9)",
                      }}
                    />
                  )}
                </div>
                <span
                  style={{
                    fontSize: 13,
                    color: isPast
                      ? "rgba(255,255,255,0.3)"
                      : isCurrent
                      ? "rgba(255,255,255,0.9)"
                      : "rgba(255,255,255,0.2)",
                    fontWeight: isCurrent ? 500 : 400,
                    transition: "color 0.3s ease",
                  }}
                >
                  {STEP_LABELS[step] ?? step}
                </span>
              </div>
            )
          })}
          {isComplete && (
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(80,120,255,0.85)",
                }}
              >
                <Check style={{ width: 11, height: 11, color: "#fff", strokeWidth: 3 }} />
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.9)",
                  fontWeight: 500,
                }}
              >
                Ready to generate
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function OnboardingFlow({ onExit, initialData }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY)
      if (saved) return JSON.parse(saved).currentStep ?? 0
    } catch {}
    // Skip "findRace" step if race is already provided (e.g. selected on landing page)
    return initialData?.race ? 1 : 0
  })
  const [direction, setDirection] = useState<1 | -1>(1)
  const [formData, setFormData] = useState<OnboardingData>(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY)
      if (saved) {
        const { formData: savedData } = JSON.parse(saved)
        // Race comes from initialData (has correct Date object); merge the rest from draft
        return {
          ...savedData,
          ...(initialData ?? {}),
          race: initialData?.race ?? (savedData.race ? { ...savedData.race, date: new Date(savedData.race.date) } : undefined),
        }
      }
    } catch {}
    return initialData ?? {}
  })
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const { data: sessionData, isPending: sessionPending } = authClient.useSession()

  useEffect(() => {
    if (formData.units) return        // already set in restored draft — skip
    if (sessionPending) return        // wait for session to resolve
    const sessionUnits = (sessionData?.user as { units?: "km" | "miles" } | undefined)?.units
    setFormData((prev) => ({ ...prev, units: sessionUnits ?? detectUnits() }))
  }, [sessionData, sessionPending, formData.units])

  useEffect(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, currentStep }))
  }, [formData, currentStep])

  const steps = getSteps()
  const isComplete = currentStep >= steps.length

  function advance() {
    setDirection(1)
    setCurrentStep((s) => s + 1)
  }

  function goBack() {
    if (currentStep === 0) {
      setShowExitConfirm(true)
      return
    }
    setDirection(-1)
    setCurrentStep((s) => s - 1)
  }

  function handleNext(data: Partial<OnboardingData>) {
    const merged = { ...formData, ...data }
    setFormData(merged)
    advance()
  }

  const stepKey = isComplete ? "final" : steps[currentStep]
  const stepProps = { formData, onNext: handleNext }

  function renderStep() {
    if (isComplete) return <FinalScreen formData={formData} />
    const stepName = steps[currentStep]
    switch (stepName) {
      case "findRace":           return <StepFindRace {...stepProps} />
      case "goalTime":           return <StepGoalTime {...stepProps} />
      case "whichDays":          return <StepWhichDays {...stepProps} />
      case "weeklyMileage":      return <StepWeeklyMileage {...stepProps} />
      case "strength":           return <StepStrength {...stepProps} />
      default:             return null
    }
  }

  return (
    <div className="min-h-svh flex flex-col md:flex-row">
      <LeftPanel
        race={formData.race}
        steps={steps}
        currentStep={currentStep}
        isComplete={isComplete}
        units={formData.units ?? "km"}
      />

      {/* Right panel */}
      <div className="flex-1 flex flex-col">
        {/* Nav */}
        {showExitConfirm ? (
          <div className="flex items-center justify-between px-6 py-5 md:px-10 md:py-7">
            <p className="text-sm text-muted-foreground">
              Leave setup? Progress will be lost.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { sessionStorage.removeItem(DRAFT_KEY); onExit() }}
                className="cursor-pointer text-sm text-destructive hover:text-destructive/80 transition-colors"
              >
                Exit
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 px-6 py-5 md:px-10 md:py-7">
            <button
              onClick={goBack}
              aria-label="Go back"
              className="flex shrink-0 cursor-pointer items-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Progress bar — mobile only */}
            <div className="flex-1 md:hidden px-2">
              {!isComplete && (
                <OnboardingProgress
                  currentStep={currentStep}
                  totalSteps={steps.length}
                />
              )}
            </div>

            <button
              onClick={() => setShowExitConfirm(true)}
              className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground transition-colors ml-auto"
              aria-label="Exit"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Content — vertically centered on desktop */}
        <div className="flex-1 flex items-start md:items-center justify-center px-6 md:px-16 lg:px-24 pb-10 md:pb-0">
          <div className="w-full max-w-sm md:max-w-md">
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
        </div>
      </div>
    </div>
  )
}
