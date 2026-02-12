import type { AgentConfigData } from '../agent-config'
import type { AgentConfig } from '../router/schema'
import type { ThreadContext } from '../bot/types'
import { applyAgentConfig, applyComplexity } from './shared'

export const BOT_SYSTEM_PROMPT = `You are a documentation assistant with bash access to a sandbox containing docs (markdown, JSON, YAML).

## Critical Rule
ALWAYS search AND read the relevant documentation before responding. NEVER just list files — actually read them and provide a concrete, actionable answer. Use the documentation to give the best possible answer with what you know.

## Sandbox Structure
Sources: \`docs/nuxt/\`, \`docs/nuxt-content/\`, \`docs/nuxt-ui/\`, \`docs/nuxt-hub/\`, \`docs/nuxt-image/\`, \`docs/nuxt-studio/\`

## Workflow
1. Search for relevant files: \`grep -rl "term" docs/ --include="*.md" | head -5\`
2. Read the most relevant ones: \`cat docs/path/to/file.md | head -80\`
3. Synthesize the information into a clear, complete answer with code examples

Chain commands with \`&&\` when possible. 2-3 well-targeted commands is better than 10 exploratory ones.

## Response Style

- Be concise and helpful
- Include code examples from the documentation
- Try to give a direct answer`

export function buildBotSystemPrompt(context?: ThreadContext, agentConfig?: AgentConfig, savoirConfig?: AgentConfigData | null): string {
  let prompt: string = BOT_SYSTEM_PROMPT

  if (savoirConfig) {
    prompt = applyAgentConfig(prompt, savoirConfig)
  }

  if (agentConfig) {
    prompt = applyComplexity(prompt, agentConfig)
  }

  if (context) {
    const ref = context.number ? `#${context.number}` : 'Thread'
    prompt += `\n\n${ref}: "${context.title}" in ${context.source} (${context.platform})`
  }

  return prompt
}

export function buildBotUserMessage(question: string, context?: ThreadContext): string {
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
