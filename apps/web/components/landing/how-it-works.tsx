import { StepCard } from "./step-card"
import { Target, Dumbbell, Sparkles } from "lucide-react"

const steps = [
  {
    icon: Target,
    title: "Set Your Goal",
    description: "Tell us your target race, timeline, and current fitness level.",
  },
  {
    icon: Dumbbell,
    title: "Train & Log",
    description: "Follow your personalized plan and log how each workout feels.",
  },
  {
    icon: Sparkles,
    title: "Athloryx Adapts",
    description: "Your plan automatically adjusts based on your feedback and progress.",
  },
]

export function HowItWorks() {
  return (
    <section className="w-full">
      <h2 className="mb-8 text-center text-lg font-medium">How It Works</h2>
      <div className="grid gap-8 sm:grid-cols-3">
        {steps.map((step, index) => (
          <StepCard
            key={step.title}
            step={index + 1}
            icon={step.icon}
            title={step.title}
            description={step.description}
          />
        ))}
      </div>
    </section>
  )
}
