"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps, OnboardingData } from "../types"

type MileageRange = NonNullable<OnboardingData["weeklyMileageRange"]>

const KM_OPTIONS: { value: MileageRange; label: string; description: string; badge: string }[] = [
  { value: "0-10",   label: "Just getting started", description: "Little or no current running",              badge: "0–10 km/wk"  },
  { value: "10-25",  label: "Occasional runner",     description: "1–2 runs a week, mostly short",            badge: "10–25 km/wk" },
  { value: "25-40",  label: "Regular runner",        description: "3–4 days/week, comfortable up to ~10 km",  badge: "25–40 km/wk" },
  { value: "40-60",  label: "Consistent runner",     description: "4–5 days/week, regular long runs",         badge: "40–60 km/wk" },
  { value: "60-80",  label: "Club runner",           description: "5–6 days/week, comfortable at distance",   badge: "60–80 km/wk" },
  { value: "80-plus",label: "High mileage runner",   description: "6–7 days/week, high weekly volume",        badge: "80+ km/wk"   },
]

const MILES_OPTIONS: { value: MileageRange; label: string; description: string; badge: string }[] = [
  { value: "0-10",   label: "Just getting started", description: "Little or no current running",              badge: "0–6 mi/wk"   },
  { value: "10-25",  label: "Occasional runner",     description: "1–2 runs a week, mostly short",            badge: "6–15 mi/wk"  },
  { value: "25-40",  label: "Regular runner",        description: "3–4 days/week, comfortable up to ~10 km",  badge: "15–25 mi/wk" },
  { value: "40-60",  label: "Consistent runner",     description: "4–5 days/week, regular long runs",         badge: "25–37 mi/wk" },
  { value: "60-80",  label: "Club runner",           description: "5–6 days/week, comfortable at distance",   badge: "37–50 mi/wk" },
  { value: "80-plus",label: "High mileage runner",   description: "6–7 days/week, high weekly volume",        badge: "50+ mi/wk"   },
]

export function StepWeeklyMileage({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<MileageRange | undefined>(formData.weeklyMileageRange)
  const units = formData.units ?? "km"
  const options = units === "miles" ? MILES_OPTIONS : KM_OPTIONS

  function handleSelect(value: MileageRange) {
    setSelected(value)
    setTimeout(() => onNext({ weeklyMileageRange: value }), 150)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          How would you describe your current running?
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick the one that fits best — we'll build your plan from here.
        </p>
      </div>
      <div className="space-y-3">
        {options.map((opt) => (
          <OnboardingCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            badge={opt.badge}
            selected={selected === opt.value}
            onClick={() => handleSelect(opt.value)}
          />
        ))}
      </div>
    </div>
  )
}
