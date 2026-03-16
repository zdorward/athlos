export { type AIProvider } from "./provider"
export {
  type WorkoutDay,
  type WorkoutType,
  type TrainingPlan,
  type TrainingPlanMeta,
  type PlanGenerationInput,
  type PhaseEntry,
} from "./types"
export { buildBridgeRuns } from "./bridge-runs"
export * from "./adaptation"
export { peakStrengthDay, firstMondayOnOrAfter } from "./race-prompt"
export { recommendStrengthCount, recommendStrengthDays } from "./strength-recommendation"
export { computeGoalPeakMileage } from "./pace-calculator"

let _provider: import("./provider").AIProvider | undefined

export function getProvider(): import("./provider").AIProvider {
  if (!_provider) {
    const { ClaudeProvider } = require("./providers/claude") as { ClaudeProvider: typeof import("./providers/claude").ClaudeProvider }
    const { loadConfig } = require("./config") as { loadConfig: typeof import("./config").loadConfig }
    const { provider, model } = loadConfig()
    if (provider === "claude") {
      _provider = new ClaudeProvider(model)
    } else {
      throw new Error(`Unhandled provider: ${provider}`)
    }
  }
  return _provider
}
