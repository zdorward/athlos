"use client"

import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import type { DayPlan, WorkoutType } from "./use-demo-state"
import { Check } from "lucide-react"

const workoutTypeColors: Record<WorkoutType, string> = {
  easy: "bg-blue-500/10 text-blue-500",
  tempo: "bg-orange-500/10 text-orange-500",
  intervals: "bg-red-500/10 text-red-500",
  long: "bg-purple-500/10 text-purple-500",
  rest: "bg-zinc-500/10 text-zinc-500",
  strength: "bg-yellow-500/10 text-yellow-500",
  recovery: "bg-green-500/10 text-green-500",
}

interface WeeklyPlanDayProps {
  plan: DayPlan
}

export function WeeklyPlanDay({ plan }: WeeklyPlanDayProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border p-3 transition-all",
        plan.isToday && "ring-2 ring-primary",
        plan.completed && "opacity-60"
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">
        {plan.shortDay}
      </span>
      <Badge className={cn("text-[10px]", workoutTypeColors[plan.type])}>
        {plan.title}
      </Badge>
      {plan.completed && (
        <Check className="h-3 w-3 text-green-500" />
      )}
    </div>
  )
}
