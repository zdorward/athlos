import Anthropic from "@anthropic-ai/sdk"
import type { AIProvider } from "../provider"
import type { PlanGenerationInput } from "../types"
import { buildPrompt } from "../prompt"

export class ClaudeProvider implements AIProvider {
  private client = new Anthropic()

  async *streamPlan(input: PlanGenerationInput): AsyncIterable<string> {
    const { system, user } = buildPrompt(input)

    const stream = await this.client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: user }],
    })

    let buffer = ""
    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        buffer += chunk.delta.text
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (line.trim()) yield line.trim()
        }
      }
    }
    if (buffer.trim()) yield buffer.trim()
  }
}
