"use client"

import { useDemoState } from "./use-demo-state"
import { WeeklyPlanDay } from "./weekly-plan-day"

export function WeeklyPlan() {
  const state = useDemoState()

  return (
    <section className="w-full">
      <h2 className="mb-4 text-center text-lg font-medium">This Week</h2>
      <div className="grid grid-cols-7 gap-2">
        {state.weeklyPlan.map((day) => (
          <WeeklyPlanDay key={day.day} plan={day} />
        ))}
      </div>
    </section>
  )
}
