const PROVIDERS = ["claude"] as const
type Provider = (typeof PROVIDERS)[number]

export interface AIConfig {
  provider: Provider
  model: string
}

export function loadConfig(): AIConfig {
  const provider = process.env.AI_PROVIDER ?? "claude"
  const model = process.env.AI_MODEL ?? "claude-haiku-4-5-20251001"

  if (!PROVIDERS.includes(provider as Provider)) {
    throw new Error(
      `Unknown AI provider: "${provider}". Valid: ${PROVIDERS.join(", ")}`,
    )
  }

  return { provider: provider as Provider, model }
}
