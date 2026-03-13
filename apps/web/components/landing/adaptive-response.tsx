"use client"

import { useDemoState } from "./use-demo-state"
import { CheckCircle } from "lucide-react"

export function AdaptiveResponse() {
  const state = useDemoState()

  return (
    <div className="flex items-start gap-3 rounded-lg bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{state.adaptiveMessage}</p>
    </div>
  )
}
