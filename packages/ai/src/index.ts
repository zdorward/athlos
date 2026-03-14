import { ClaudeProvider } from "./providers/claude"
import { loadConfig } from "./config"
import type { AIProvider } from "./provider"

export { type AIProvider } from "./provider"
export {
  type WorkoutDay,
  type WorkoutType,
  type TrainingPlan,
  type TrainingPlanMeta,
  type PlanGenerationInput,
} from "./types"

function createProvider(): AIProvider {
  const { provider, model } = loadConfig()
  if (provider === "claude") return new ClaudeProvider(model)
  throw new Error(`Unhandled provider: ${provider}`)
}

const _provider: AIProvider = createProvider()

export function getProvider(): AIProvider {
  return _provider
}
