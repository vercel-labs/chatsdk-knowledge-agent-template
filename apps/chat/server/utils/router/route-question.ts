import { createGateway } from '@ai-sdk/gateway'
import { generateText, Output } from 'ai'
import { log } from 'evlog'
import type { UIMessage } from 'ai'
import { type AgentConfig, agentConfigSchema, getDefaultConfig } from './schema'

const ROUTER_MODEL = 'google/gemini-2.5-flash-lite'

const ROUTER_SYSTEM_PROMPT = `You are a question classifier for an AI assistant.
Analyze the user's question and determine the appropriate configuration for the agent.

## Classification Guidelines

**trivial** (maxSteps: 3, model: gemini-2.5-flash-lite)
- Simple greetings: "Hello", "Thanks", "Hi there"
- Acknowledgments without questions

**simple** (maxSteps: 6, model: gemini-2.5-flash-lite)
- Single concept lookups: "What is X?", "How to use Y?"
- Direct questions with likely clear answers
- Questions about a single topic

**moderate** (maxSteps: 12, model: gemini-3-flash)
- Comparisons: "Difference between X and Y?"
- Integration questions requiring exploration
- Questions requiring multiple file searches

**complex** (maxSteps: 20, model: gemini-3-flash or claude-opus-4.5)
- Debugging scenarios
- Architecture questions
- Deep analysis requiring extensive research
- Cross-topic questions

Use claude-opus-4.5 only for the most complex cases requiring deep reasoning.`

function extractQuestionFromMessages(messages: UIMessage[]): string {
  // Get the last user message
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUserMessage) return ''

  // Extract text from message parts
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

export function buildSystemPromptWithComplexity(basePrompt: string, agentConfig: AgentConfig): string {
  const complexityHints: Record<AgentConfig['complexity'], string> = {
    trivial: 'This is a simple greeting or acknowledgment. Respond briefly without searching.',
    simple: 'This is a straightforward question. Explore with `ls`, then do a targeted search.',
    moderate: 'This requires some research. Explore the sources structure first, then search within relevant directories.',
    complex: 'This is a complex question. Map out the available sources with `ls`, then systematically search relevant areas.',
  }

  return `${basePrompt}\n\n## Task Complexity: ${agentConfig.complexity}\n${complexityHints[agentConfig.complexity]}`
}
