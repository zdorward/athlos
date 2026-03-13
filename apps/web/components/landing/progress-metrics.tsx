"use client"

import { useDemoState } from "./use-demo-state"
import { MetricCard } from "./metric-card"
import { Timer, TrendingUp, Route } from "lucide-react"

export function ProgressMetrics() {
  const state = useDemoState()
  const { metrics } = state

  return (
    <section className="w-full">
      <h2 className="mb-4 text-center text-lg font-medium">Your Progress</h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <MetricCard
          icon={Timer}
          label="Projected Marathon"
          value={metrics.marathonTime}
          trend="neutral"
        />
        <MetricCard
          icon={TrendingUp}
          label="Consistency"
          value={`${metrics.consistency}%`}
          trend="up"
        />
        <MetricCard
          icon={Route}
          label="Weekly Mileage"
          value={`${metrics.weeklyMileage}km`}
          trend="up"
        />
      </div>
    </section>
  )
}
