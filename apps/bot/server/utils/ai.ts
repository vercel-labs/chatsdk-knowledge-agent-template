import { generateText, Output, stepCountIs, ToolLoopAgent } from 'ai'
import { log } from 'evlog'
import { createSavoir, type AgentConfig as SavoirAgentConfig } from '@savoir/sdk'
import type { ThreadContext } from './types'
import { type AgentConfig, agentConfigSchema, getDefaultConfig } from './router-schema'

const ROUTER_MODEL = 'google/gemini-2.5-flash-lite'

const ROUTER_SYSTEM_PROMPT = `You are a question classifier for a documentation assistant bot.
Analyze the user's question and determine the appropriate configuration for the agent.

## Classification Guidelines

**trivial** (maxSteps: 3, model: gemini-2.5-flash-lite)
- Simple greetings: "Hello", "Thanks", "Hi there"
- Acknowledgments without questions

**simple** (maxSteps: 6, model: gemini-2.5-flash-lite)
- Single concept lookups: "What is useAsyncData?", "How to use useFetch?"
- Direct API questions with clear answers

**moderate** (maxSteps: 12, model: gemini-3-flash)
- Comparisons: "Difference between useFetch and useAsyncData?"
- Integration questions: "How to use Nuxt with TypeScript?"
- Questions requiring multiple file searches

**complex** (maxSteps: 20, model: gemini-3-flash or claude-opus-4.5)
- Debugging scenarios: "My middleware isn't working with auth"
- Architecture questions: "How to structure a multi-package monorepo?"
- Deep analysis requiring extensive documentation review

Use claude-opus-4.5 only for the most complex cases requiring deep reasoning.`

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
  const config = useRuntimeConfig()

  if (!config.savoir.apiUrl) {
    return `Hello! I'm the documentation bot, but I'm not fully configured yet.

Please set the following environment variables:
- \`NUXT_SAVOIR_API_URL\` - URL of the Savoir chat API
- \`NUXT_SAVOIR_API_KEY\` - API key (if required)

Once configured, I'll be able to search the documentation and help answer your questions!`
  }

  const startTime = Date.now()

  try {
    const savoir = createSavoir({
      apiUrl: config.savoir.apiUrl,
      apiKey: config.savoir.apiKey || undefined,
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
      instructions: buildSystemPrompt(context, routerConfig, savoirConfig),
      tools: savoir.tools,
      stopWhen: stepCountIs(effectiveMaxSteps),
    })

    const result = await agent.generate({
      prompt: buildUserMessage(question, context),
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

function buildSystemPrompt(context?: ThreadContext, agentConfig?: AgentConfig, savoirConfig?: SavoirAgentConfig | null): string {
  const basePrompt = `You are a documentation assistant with bash access to a sandbox containing docs (markdown, JSON, YAML).

## Critical Rule
ALWAYS search AND read the relevant documentation before responding. NEVER just list files — actually read them and provide a concrete, actionable answer. Use the documentation to give the best possible answer with what you know.

## Sandbox Structure
Sources: \`docs/nuxt/\`, \`docs/nuxt-content/\`, \`docs/nuxt-ui/\`, \`docs/nuxt-hub/\`, \`docs/nuxt-image/\`, \`docs/nuxt-studio/\`

## Workflow
1. Search for relevant files: \`grep -rl "term" docs/ --include="*.md" | head -5\`
2. Read the most relevant ones: \`cat docs/path/to/file.md | head -80\`
3. Synthesize the information into a clear, complete answer with code examples

Chain commands with \`&&\` when possible. 2-3 well-targeted commands is better than 10 exploratory ones.

## Response
- Be concise and helpful
- Include code examples from the documentation
- Try to give a direct answer`

  let prompt = basePrompt

  if (savoirConfig) {
    const styleInstructions: Record<SavoirAgentConfig['responseStyle'], string> = {
      concise: 'Keep your responses brief and to the point.',
      detailed: 'Provide comprehensive explanations with context.',
      technical: 'Focus on technical details and include code examples.',
      friendly: 'Be conversational and approachable in your responses.',
    }

    if (savoirConfig.responseStyle !== 'concise') {
      prompt = prompt.replace(
        '## Response\n- Be concise and helpful',
        `## Response\n- ${styleInstructions[savoirConfig.responseStyle]}`,
      )
    }

    if (savoirConfig.language && savoirConfig.language !== 'en') {
      prompt += `\n\n## Language\nRespond in ${savoirConfig.language}.`
    }

    if (savoirConfig.searchInstructions) {
      prompt += `\n\n## Custom Search Instructions\n${savoirConfig.searchInstructions}`
    }

    if (savoirConfig.additionalPrompt) {
      prompt += `\n\n## Additional Instructions\n${savoirConfig.additionalPrompt}`
    }
  }

  if (agentConfig) {
    const complexityHints: Record<AgentConfig['complexity'], string> = {
      trivial: 'This is a simple greeting or acknowledgment. Respond briefly without searching.',
      simple: 'This is a straightforward question. One or two searches should suffice.',
      moderate: 'This requires some research. Take time to find relevant documentation.',
      complex: 'This is a complex question. Thoroughly search the documentation and provide a detailed answer.',
    }
    prompt += `\n\n## Task Complexity: ${agentConfig.complexity}\n${complexityHints[agentConfig.complexity]}`
  }

  if (context) {
    const ref = context.number ? `#${context.number}` : 'Thread'
    prompt += `\n\n${ref}: "${context.title}" in ${context.source} (${context.platform})`
  }

  return prompt
}

function buildUserMessage(question: string, context?: ThreadContext): string {
  const cleanQuestion = question.replace(/@[\w-]+(\[bot\])?/gi, '').trim()
  const parts: string[] = []

  if (context) {
    if (context.body) {
      parts.push(`**Description:**\n${context.body.slice(0, 1000)}`)
    }

    if (context.previousComments?.length) {
      const relevant = context.previousComments
        .filter(c => !c.isBot)
        .slice(-2)
        .map(c => `@${c.author}: ${c.body.slice(0, 200)}`)

      if (relevant.length) {
        parts.push(`**Previous comments:**\n${relevant.join('\n')}`)
      }
    }
  }

  parts.push(`**Question:**\n${cleanQuestion || context?.title || 'How can I help?'}`)

  return parts.join('\n\n')
}
