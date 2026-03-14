import { ClaudeProvider } from "./providers/claude.js"
import type { AIProvider } from "./provider.js"

export { type AIProvider } from "./provider.js"
export {
  type WorkoutDay,
  type WorkoutType,
  type TrainingPlan,
  type TrainingPlanMeta,
  type PlanGenerationInput,
} from "./types.js"

export function getProvider(): AIProvider {
  return new ClaudeProvider()
}
