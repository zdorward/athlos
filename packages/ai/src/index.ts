import { ClaudeProvider } from "./providers/claude"
import type { AIProvider } from "./provider"

export { type AIProvider } from "./provider"
export {
  type WorkoutDay,
  type WorkoutType,
  type TrainingPlan,
  type TrainingPlanMeta,
  type PlanGenerationInput,
} from "./types"

const _provider: AIProvider = new ClaudeProvider()

export function getProvider(): AIProvider {
  return _provider
}
