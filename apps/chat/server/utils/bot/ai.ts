import { generateText, Output } from 'ai'
import { log } from 'evlog'
import { type AgentConfig, agentConfigSchema, DEFAULT_MODEL, getDefaultConfig, ROUTER_MODEL } from '../router/schema'
import { ROUTER_SYSTEM_PROMPT } from '../prompts/router'
import { buildBotSystemPrompt, buildBotUserMessage } from '../prompts/bot'
import { createAgent } from '../create-agent'
import { createInternalSavoir } from './savoir'
import type { ThreadContext } from './types'

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

    const agent = createAgent({
      tools: savoir.tools,
      route: () => routeQuestion(question, context),
      buildPrompt: (routerConfig, agentConfig) => buildBotSystemPrompt(context, routerConfig, agentConfig),
      resolveModel: (routerConfig, agentConfig) => agentConfig.defaultModel || routerConfig.model,
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

    // If the agent exhausted all steps on tool calls without producing text,
    // do one final call with NO tools to force a text response.
    if (!result.text?.trim()) {
      log.info('bot', 'Agent produced no text, forcing fallback generation')
      const fallback = await generateText({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'user', content: buildBotUserMessage(question, context) },
          ...result.response.messages,
        ],
      })
      if (fallback.text?.trim()) {
        return fallback.text
      }
    }

    return result.text || `I searched the documentation but couldn't generate a helpful response for:

> ${question}

**Suggestions:**
- Try rephrasing your question with different keywords
- Check the official documentation directly
- Open a discussion for more complex questions`
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
