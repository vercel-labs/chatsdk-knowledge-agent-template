import { pruneMessages, type StepResult, type ToolSet } from 'ai'
import type { ModelMessage } from '@ai-sdk/provider-utils'

export function compactContext({
  messages,
  steps,
  tokenThreshold = 40_000,
  minTrimSavings = 20_000,
  protectLastUserMessages = 3,
}: {
  messages: ModelMessage[]
  steps: StepResult<ToolSet>[]
  tokenThreshold?: number
  minTrimSavings?: number
  protectLastUserMessages?: number
}): ModelMessage[] {
  if (messages.length === 0) return messages

  const lastStep = steps[steps.length - 1]
  const currentTokens = lastStep?.usage?.inputTokens ?? 0
  if (currentTokens <= tokenThreshold) return messages

  let cutoffIndex = 0
  let seenUsers = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') {
      seenUsers++
      if (seenUsers >= protectLastUserMessages) {
        cutoffIndex = i
        break
      }
    }
  }

  if (cutoffIndex === 0) return messages

  let toolChars = 0
  for (let i = 0; i < cutoffIndex; i++) {
    const message = messages[i]
    if (!Array.isArray(message?.content)) continue
    for (const part of message.content) {
      if (part.type === 'tool-call' || part.type === 'tool-result') {
        toolChars += JSON.stringify(part).length
      }
    }
  }

  const estimatedSavings = Math.ceil(toolChars / 4)
  if (estimatedSavings < minTrimSavings) return messages

  const messagesToProtect = messages.length - cutoffIndex
  const toolCallsOption = messagesToProtect === 0
    ? 'all'
    : (`before-last-${messagesToProtect}-messages` as const)

  return pruneMessages({
    messages,
    toolCalls: toolCallsOption,
    emptyMessages: 'remove',
  })
}
