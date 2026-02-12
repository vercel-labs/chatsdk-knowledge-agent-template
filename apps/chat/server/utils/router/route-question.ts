import { createGateway } from '@ai-sdk/gateway'
import { generateText, Output } from 'ai'
import { log } from 'evlog'
import type { UIMessage } from 'ai'
import { ROUTER_SYSTEM_PROMPT } from '../prompts/router'
import { type AgentConfig, agentConfigSchema, getDefaultConfig, ROUTER_MODEL } from './schema'

function extractQuestionFromMessages(messages: UIMessage[]): string {
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUserMessage) return ''

  const textParts = lastUserMessage.parts
    ?.filter((p): p is { type: 'text', text: string } => p.type === 'text')
    .map(p => p.text)
    .join('\n')

  return textParts || ''
}

export async function routeQuestion(
  messages: UIMessage[],
  requestId: string,
): Promise<AgentConfig> {
  const config = useRuntimeConfig()
  const gateway = createGateway({ apiKey: config.savoir?.apiKey })

  const question = extractQuestionFromMessages(messages)
  if (!question) {
    log.info('chat', `[${requestId}] Router: no question found, using default config`)
    return getDefaultConfig()
  }

  try {
    const { output } = await generateText({
      model: gateway(ROUTER_MODEL),
      output: Output.object({ schema: agentConfigSchema }),
      messages: [
        { role: 'system', content: ROUTER_SYSTEM_PROMPT },
        { role: 'user', content: `Question: ${question}` },
      ],
    })

    if (!output) {
      log.warn('chat', `[${requestId}] Router returned no output, using default config`)
      return getDefaultConfig()
    }

    log.info('chat', `[${requestId}] Router decision: ${output.complexity} (${output.model}, ${output.maxSteps} steps) - ${output.reasoning}`)
    return output
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('chat', `[${requestId}] Router failed: ${errorMessage}, using default config`)
    return getDefaultConfig()
  }
}
