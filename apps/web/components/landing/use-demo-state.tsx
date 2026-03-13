"use client"

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react"

export type FeedbackValue = "easy" | "moderate" | "hard" | "very-hard"
export type DemoPhase = "idle" | "feedback" | "adapting" | "adapted"

export type WorkoutType = "easy" | "tempo" | "intervals" | "long" | "rest" | "strength" | "recovery"

export interface DayPlan {
  day: string
  shortDay: string
  type: WorkoutType
  title: string
  completed: boolean
  isToday: boolean
}

export interface Metrics {
  marathonTime: string
  consistency: number
  weeklyMileage: number
}

export interface DemoState {
  demoPhase: DemoPhase
  feedbackValue: FeedbackValue | null
  currentWorkout: {
    title: string
    distance: string
    targetPace: string
  }
  weeklyPlan: DayPlan[]
  metrics: Metrics
  adaptiveMessage: string | null
}

type DemoAction =
  | { type: "OPEN_FEEDBACK" }
  | { type: "SUBMIT_FEEDBACK"; payload: FeedbackValue }
  | { type: "FINISH_ADAPTING" }
  | { type: "RESET" }

const initialWeeklyPlan: DayPlan[] = [
  { day: "Monday", shortDay: "Mon", type: "easy", title: "Easy Run", completed: true, isToday: false },
  { day: "Tuesday", shortDay: "Tue", type: "strength", title: "Strength", completed: true, isToday: false },
  { day: "Wednesday", shortDay: "Wed", type: "easy", title: "Easy Run", completed: false, isToday: true },
  { day: "Thursday", shortDay: "Thu", type: "tempo", title: "Tempo", completed: false, isToday: false },
  { day: "Friday", shortDay: "Fri", type: "rest", title: "Rest", completed: false, isToday: false },
  { day: "Saturday", shortDay: "Sat", type: "intervals", title: "Intervals", completed: false, isToday: false },
  { day: "Sunday", shortDay: "Sun", type: "long", title: "Long Run", completed: false, isToday: false },
]

const initialState: DemoState = {
  demoPhase: "idle",
  feedbackValue: null,
  currentWorkout: {
    title: "8km Easy Run",
    distance: "8km",
    targetPace: "5:30/km",
  },
  weeklyPlan: initialWeeklyPlan,
  metrics: {
    marathonTime: "3:45:00",
    consistency: 87,
    weeklyMileage: 42,
  },
  adaptiveMessage: null,
}

function getAdaptedPlan(plan: DayPlan[], feedback: FeedbackValue): DayPlan[] {
  const newPlan: DayPlan[] = plan.map((day) => ({ ...day }))
  const todayIndex = newPlan.findIndex((d) => d.isToday)

  // Mark today as completed
  const today = newPlan[todayIndex]
  if (todayIndex !== -1 && today) {
    today.completed = true
  }

  // Find tomorrow
  const tomorrowIndex = todayIndex + 1
  const tomorrow = newPlan[tomorrowIndex]
  if (tomorrowIndex >= newPlan.length || !tomorrow) return newPlan

  switch (feedback) {
    case "very-hard":
      newPlan[tomorrowIndex] = {
        ...tomorrow,
        type: "recovery",
        title: "Recovery",
      }
      break
    case "hard":
      // Reduce intensity - turn tempo/intervals into easy
      if (tomorrow.type === "tempo" || tomorrow.type === "intervals") {
        newPlan[tomorrowIndex] = {
          ...tomorrow,
          type: "easy",
          title: "Easy Run",
        }
      }
      break
    case "easy":
      // Increase intensity - turn easy into tempo
      if (tomorrow.type === "easy") {
        newPlan[tomorrowIndex] = {
          ...tomorrow,
          type: "tempo",
          title: "Tempo Run",
        }
      }
      break
    case "moderate":
      // Plan unchanged
      break
  }

  return newPlan
}

function getAdaptiveMessage(feedback: FeedbackValue): string {
  switch (feedback) {
    case "very-hard":
      return "Tomorrow adjusted to recovery. Your body needs rest to adapt."
    case "hard":
      return "Tomorrow's intensity reduced. Building fitness takes patience."
    case "easy":
      return "Tomorrow's workout increased. You're ready for more."
    case "moderate":
      return "Plan unchanged. You're right on track."
  }
}

function getUpdatedMetrics(metrics: Metrics, _feedback: FeedbackValue): Metrics {
  return {
    ...metrics,
    consistency: Math.min(100, metrics.consistency + 2),
    weeklyMileage: metrics.weeklyMileage + 8,
  }
}

function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "OPEN_FEEDBACK":
      return { ...state, demoPhase: "feedback" }
    case "SUBMIT_FEEDBACK":
      return {
        ...state,
        demoPhase: "adapting",
        feedbackValue: action.payload,
        adaptiveMessage: getAdaptiveMessage(action.payload),
      }
    case "FINISH_ADAPTING":
      if (!state.feedbackValue) return state
      return {
        ...state,
        demoPhase: "adapted",
        weeklyPlan: getAdaptedPlan(state.weeklyPlan, state.feedbackValue),
        metrics: getUpdatedMetrics(state.metrics, state.feedbackValue),
      }
    case "RESET":
      return initialState
    default:
      return state
  }
}

const DemoContext = createContext<DemoState | null>(null)
const DemoDispatchContext = createContext<Dispatch<DemoAction> | null>(null)

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, initialState)

  return (
    <DemoContext.Provider value={state}>
      <DemoDispatchContext.Provider value={dispatch}>
        {children}
      </DemoDispatchContext.Provider>
    </DemoContext.Provider>
  )
}

export function useDemoState() {
  const context = useContext(DemoContext)
  if (!context) {
    throw new Error("useDemoState must be used within a DemoProvider")
  }
  return context
}

export function useDemoDispatch() {
  const context = useContext(DemoDispatchContext)
  if (!context) {
    throw new Error("useDemoDispatch must be used within a DemoProvider")
  }
  return context
}
