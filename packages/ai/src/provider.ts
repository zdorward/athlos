import type { PlanGenerationInput } from "./types.js"

export interface AIProvider {
  streamPlan(input: PlanGenerationInput): AsyncIterable<string>
}
