import { createGateway } from '@ai-sdk/gateway'
import { generateText, Output, stepCountIs, ToolLoopAgent } from 'ai'
import { log } from 'evlog'
import { createSavoir } from '@savoir/sdk'
import type { IssueContext } from './types'
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

function buildRouterInput(question: string, context?: IssueContext): string {
  const parts: string[] = []

  if (context) {
    parts.push(`Repository: ${context.owner}/${context.repo}`)
    parts.push(`Issue #${context.number}: ${context.title}`)
    if (context.body) {
      parts.push(`Issue body: ${context.body.slice(0, 500)}`)
    }
    if (context.labels.length) {
      parts.push(`Labels: ${context.labels.join(', ')}`)
    }
  }

  parts.push(`Question: ${question}`)

  return parts.join('\n')
}

async function routeQuestion(question: string, context?: IssueContext): Promise<AgentConfig> {
  const config = useRuntimeConfig()
  const gateway = createGateway({ apiKey: config.savoir.apiKey })

  try {
    const { output } = await generateText({
      model: gateway(ROUTER_MODEL),
      output: Output.object({ schema: agentConfigSchema }),
      messages: [
        { role: 'system', content: ROUTER_SYSTEM_PROMPT },
        { role: 'user', content: buildRouterInput(question, context) },
      ],
    })

    if (!output) {
      log.warn('github-bot', 'Router returned no output, using default config')
      return getDefaultConfig()
    }

    log.info('github-bot', `Router decision: ${output.complexity} (${output.model}, ${output.maxSteps} steps) - ${output.reasoning}`)
    return output
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    log.error('github-bot', `Router failed: ${errorMessage}, using default config`)
    return getDefaultConfig()
  }
}

export async function generateAIResponse(
  question: string,
  context?: IssueContext,
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
  let stepCount = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let toolCallCount = 0

  try {
    const agentConfig = await routeQuestion(question, context)

    log.info('github-bot', `Starting agent for issue #${context?.number || 'unknown'} with ${agentConfig.complexity} complexity`)

    const savoir = createSavoir({
      apiUrl: config.savoir.apiUrl,
      apiKey: config.savoir.apiKey || undefined,
      onToolCall: (info) => {
        if (info.state === 'loading') {
          log.info('github-bot', `bash: ${JSON.stringify(info.args).slice(0, 150)}`)
        }
      },
    })

    const agent = new ToolLoopAgent({
      model: agentConfig.model,
      instructions: buildSystemPrompt(context, agentConfig),
      tools: savoir.tools,
      stopWhen: stepCountIs(agentConfig.maxSteps),
      onStepFinish: ({ usage, toolCalls }) => {
        stepCount++
        totalInputTokens += usage.inputTokens || 0
        totalOutputTokens += usage.outputTokens || 0
        toolCallCount += toolCalls?.length || 0
      },
    })

    const result = await agent.generate({
      prompt: buildUserMessage(question, context),
    })

    const durationMs = Date.now() - startTime
    log.info('github-bot', `Response generated (${durationMs}ms, ${stepCount} steps, ${toolCallCount} commands)`)
    log.info('github-bot', `Tokens: ${totalInputTokens} in / ${totalOutputTokens} out`)

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
    log.error('github-bot', `Agent failed after ${durationMs}ms: ${errorMessage}`)

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

function buildSystemPrompt(context?: IssueContext, agentConfig?: AgentConfig): string {
  const basePrompt = `You are a documentation assistant with bash access to a sandbox containing docs (markdown, JSON, YAML).

## Speed is Important
Minimize the number of commands. Chain commands with \`&&\` when possible.

## Sandbox Structure
Sources: \`docs/nuxt/\`, \`docs/nuxt-content/\`, \`docs/nuxt-ui/\`, \`docs/nuxt-hub/\`, \`docs/nuxt-image/\`, \`docs/nuxt-studio/\`

## Efficient Pattern
Do this in ONE command:
\`\`\`bash
grep -rl "term" docs/ --include="*.md" | head -5 && cat $(grep -rl "term" docs/ --include="*.md" | head -1)
\`\`\`

Or explore and search together:
\`\`\`bash
ls docs/ && grep -rl "keyword" docs/ --include="*.md" | head -10
\`\`\`

## Tips
- Chain commands with \`&&\` to reduce round-trips
- Use \`head -80\` for large files
- 2-3 well-targeted commands is better than 10 exploratory ones

## Response
- Be concise and helpful
- Include code examples
- Use markdown`

  let prompt = basePrompt

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
    prompt += `\n\nIssue #${context.number}: "${context.title}" in ${context.owner}/${context.repo}`
  }

  return prompt
}

function buildUserMessage(question: string, context?: IssueContext): string {
  const cleanQuestion = question.replace(/@[\w-]+(\[bot\])?/gi, '').trim()
  const parts: string[] = []

  if (context) {
    if (context.body) {
      parts.push(`**Issue description:**\n${context.body.slice(0, 1000)}`)
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
