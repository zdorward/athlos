import type { PlanGenerationInput } from "./types"

export interface AIProvider {
  streamPlan(input: PlanGenerationInput): AsyncIterable<string>
}
