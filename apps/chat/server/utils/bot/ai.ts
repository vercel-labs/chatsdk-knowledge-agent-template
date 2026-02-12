import { generateText, Output, stepCountIs, ToolLoopAgent } from 'ai'
import { log } from 'evlog'
import { type AgentConfig, agentConfigSchema, getDefaultConfig } from '../router/schema'
import { ROUTER_SYSTEM_PROMPT } from '../prompts/router'
import { buildBotSystemPrompt, buildBotUserMessage } from '../prompts/bot'
import { createInternalSavoir } from './savoir'
import type { ThreadContext } from './types'

const ROUTER_MODEL = 'google/gemini-2.5-flash-lite'

function buildRouterInput(question: string, context?: ThreadContext): string {
  const parts: string[] = []

  if (context) {
    parts.push(`Source: ${context.source}`)
    if (context.number) {
      parts.push(`#${context.number}: ${context.title}`)
    } else {
      parts.push(`Thread: ${context.title}`)
    }
    if (context.body) {
      parts.push(`Description: ${context.body.slice(0, 500)}`)
    }
    if (context.labels.length) {
      parts.push(`Labels: ${context.labels.join(', ')}`)
    }
  }

  parts.push(`Question: ${question}`)

  return parts.join('\n')
}

async function routeQuestion(question: string, context?: ThreadContext): Promise<AgentConfig> {
  try {
    const { output } = await generateText({
      model: ROUTER_MODEL,
      output: Output.object({ schema: agentConfigSchema }),
      messages: [
        { role: 'system', content: ROUTER_SYSTEM_PROMPT },
        { role: 'user', content: buildRouterInput(question, context) },
      ],
    })

    if (!output) {
      log.warn('bot', 'Router returned no output, using default config')
      return getDefaultConfig()
    }

    log.info('bot', `Router decision: ${output.complexity} (${output.model}, ${output.maxSteps} steps) - ${output.reasoning}`)
    return output
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('bot', `Router failed: ${errorMessage}, using default config`)
    return getDefaultConfig()
  }
}

export async function generateAIResponse(
  question: string,
  context?: ThreadContext,
): Promise<string> {
  const startTime = Date.now()

  try {
    const savoir = createInternalSavoir({
      source: context?.platform ? `${context.platform}-bot` : 'bot',
      sourceId: context?.number ? `issue-${context.number}` : undefined,
      onToolCall: (info) => {
        if (info.state === 'loading') {
          log.info('bot', `bash: ${JSON.stringify(info.args).slice(0, 150)}`)
        }
      },
    })

    const [routerConfig, savoirConfig] = await Promise.all([
      routeQuestion(question, context),
      savoir.getAgentConfig().catch((error) => {
        log.warn('bot', `Failed to fetch agent config: ${error instanceof Error ? error.message : 'Unknown error'}`)
        return null
      }),
    ])

    const effectiveMaxSteps = savoirConfig
      ? Math.round(routerConfig.maxSteps * savoirConfig.maxStepsMultiplier)
      : routerConfig.maxSteps
    const effectiveModel = savoirConfig?.defaultModel || routerConfig.model

    log.info('bot', `Starting agent for #${context?.number || 'unknown'} with ${routerConfig.complexity} complexity (${effectiveMaxSteps} steps, multiplier: ${savoirConfig?.maxStepsMultiplier || 1}x)`)

    const agent = new ToolLoopAgent({
      model: effectiveModel,
      instructions: buildBotSystemPrompt(context, routerConfig, savoirConfig),
      tools: savoir.tools,
      stopWhen: stepCountIs(effectiveMaxSteps),
    })

    const result = await agent.generate({
      prompt: buildBotUserMessage(question, context),
    })

    const durationMs = Date.now() - startTime
    const { totalUsage } = result
    log.info('bot', `Response generated (${durationMs}ms, ${result.steps.length} steps)`)
    log.info('bot', `Tokens: ${totalUsage.inputTokens ?? 0} in / ${totalUsage.outputTokens ?? 0} out`)

    savoir.reportUsage(result, {
      startTime,
      metadata: context ? { source: context.source } : undefined,
    }).catch(() => {})

    if (!result.text) {
      return `I searched the documentation but couldn't generate a helpful response for:

> ${question}

**Suggestions:**
- Try rephrasing your question with different keywords
- Check the official documentation directly
- Open a discussion for more complex questions`
    }

    return result.text
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('bot', `Agent failed after ${durationMs}ms: ${errorMessage}`)

    return `Sorry, I encountered an error while processing your question:

> ${question}

<details>
<summary>Error details</summary>

\`\`\`
${errorMessage}
\`\`\`
</details>

Please try again later or open a discussion if this persists.`
  }
}

