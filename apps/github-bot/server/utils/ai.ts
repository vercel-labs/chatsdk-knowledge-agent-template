import { ToolLoopAgent } from 'ai'
import { log } from 'evlog'
import { createSavoir } from '@savoir/sdk'
import type { IssueContext } from './types'

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
    log.info('github-bot', `Starting agent for issue #${context?.number || 'unknown'}`)

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
      model: 'google/gemini-3-flash',
      instructions: buildSystemPrompt(context),
      tools: { bash: savoir.tools.bash } as any,
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
  }
  catch (error) {
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

function buildSystemPrompt(context?: IssueContext): string {
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

  if (context) {
    return `${basePrompt}

Issue #${context.number}: "${context.title}" in ${context.owner}/${context.repo}`
  }

  return basePrompt
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
