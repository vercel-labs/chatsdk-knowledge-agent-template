import { log } from 'evlog'
import type { ModelMessage } from '@ai-sdk/provider-utils'

/**
 * Ensure all tool-call `input` fields in messages are valid JSON objects.
 * The Anthropic API rejects requests where `input` is a string instead of an object.
 * This can happen when the AI SDK carries forward a raw JSON string from a previous step.
 */
export function sanitizeToolCallInputs(messages: ModelMessage[]): ModelMessage[] {
  for (const message of messages) {
    if (message.role !== 'assistant' || !Array.isArray(message.content)) continue
    for (const part of message.content) {
      if (part.type === 'tool-call' && typeof part.input === 'string') {
        log.warn('agent', `Sanitizing tool-call input for ${part.toolName}: input was a string, parsing to object`)
        try {
          part.input = JSON.parse(part.input)
        } catch {
          part.input = {}
        }
      }
    }
  }
  return messages
}
