import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, stepCountIs, ToolLoopAgent, type UIMessage } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { kv } from '@nuxthub/kv'
import { and, eq } from 'drizzle-orm'
import { createSavoir } from '@savoir/sdk'
import { log, useLogger } from 'evlog'
import { generateTitle } from '../../utils/chat/generate-title'
import { routeQuestion, buildSystemPromptWithComplexity } from '../../utils/router/route-question'
import { getAgentConfig, type AgentConfigData } from '../../utils/agent-config'
import { KV_KEYS } from '../../utils/sandbox/types'

const BASE_SYSTEM_PROMPT = `You are an AI assistant that answers questions based on the available sources.

## CRITICAL: Sources First

Your knowledge may be outdated. ONLY answer based on what you find in the sources.
- If you can't find information, say "I couldn't find this in the available sources"
- NEVER make up information or guess - only state what you found
- Always cite the source file when quoting content

## Search Strategy

1. **Explore first** (use relative paths, NEVER recursive):
   \`\`\`bash
   ls docs/           # List available sources (NOT ls -R)
   ls docs/nitro/     # Explore one source
   \`\`\`

2. **Search with grep** (always limit results):
   \`\`\`bash
   grep -r "keyword" docs/nitro --include="*.md" -l | head -5
   \`\`\`

3. **Read files with cat**:
   \`\`\`bash
   cat docs/nitro/file.md
   \`\`\`

## IMPORTANT

- Do NOT output text between tool calls. Use tools silently, then provide your complete answer only at the end.
- Use "| head -N" to limit output

## Response Style

- Be concise and helpful
- Include relevant code examples when available
- Use markdown formatting
- Cite the source file path
`

function buildDynamicSystemPrompt(agentConfigData: AgentConfigData): string {
  let prompt = BASE_SYSTEM_PROMPT

  const styleInstructions: Record<AgentConfigData['responseStyle'], string> = {
    concise: 'Keep your responses brief and to the point.',
    detailed: 'Provide comprehensive explanations with context.',
    technical: 'Focus on technical details and include code examples.',
    friendly: 'Be conversational and approachable in your responses.',
  }
  prompt = prompt.replace(
    '## Response Style\n\n- Be concise and helpful',
    `## Response Style\n\n- ${styleInstructions[agentConfigData.responseStyle]}`,
  )

  if (agentConfigData.language && agentConfigData.language !== 'en') {
    prompt += `\n\n## Language\nRespond in ${agentConfigData.language}.`
  }

  if (agentConfigData.citationFormat === 'footnote') {
    prompt += '\n\n## Citations\nPlace all source citations as footnotes at the end of your response.'
  } else if (agentConfigData.citationFormat === 'none') {
    prompt += '\n\n## Citations\nDo not include source citations in your response.'
  }

  if (agentConfigData.searchInstructions) {
    prompt += `\n\n## Custom Search Instructions\n${agentConfigData.searchInstructions}`
  }

  if (agentConfigData.additionalPrompt) {
    prompt += `\n\n## Additional Instructions\n${agentConfigData.additionalPrompt}`
  }

  return prompt
}

defineRouteMeta({
  openAPI: {
    description: 'Chat with AI about the available sources.',
    tags: ['ai'],
  },
})

export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  const requestId = crypto.randomUUID().slice(0, 8)

  requestLog.set({
    requestId,
    path: '/api/chats/[id]',
    method: 'POST',
  })

  try {
    const session = await getUserSession(event)
    requestLog.set({ userId: session.user?.id || session.id })

    const { id } = await getValidatedRouterParams(event, z.object({
      id: z.string(),
    }).parse)
    requestLog.set({ chatId: id })

    const { model, messages } = await readValidatedBody(event, z.object({
      model: z.string(),
      messages: z.array(z.custom<UIMessage>()),
    }).parse)
    requestLog.set({ model, messageCount: messages.length })

    const chat = await db.query.chats.findFirst({
      where: () => and(
        eq(schema.chats.id, id as string),
        eq(schema.chats.userId, session.user?.id || session.id),
      ),
      with: {
        messages: true,
      },
    })
    if (!chat) {
      requestLog.error(new Error('Chat not found'))
      requestLog.set({ outcome: 'error' })
      throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
    }
    requestLog.set({ existingMessages: chat.messages.length })

    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'user' && messages.length > 1) {
      await db.insert(schema.messages).values({
        id: lastMessage.id,
        chatId: id as string,
        role: 'user',
        parts: lastMessage.parts,
      })
    }

    const { savoir: savoirConfig } = useRuntimeConfig()

    let stepCount = 0
    let toolCallCount = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let stepStartTime = Date.now()
    const stepDurations: number[] = []

    let streamWriter: any = null

    const existingSessionId = await kv.get<string>(KV_KEYS.ACTIVE_SANDBOX_SESSION)
    if (existingSessionId) {
      log.info('chat', `[${requestId}] Found active sandbox session ${existingSessionId}`)
    }

    const savoir = createSavoir({
      apiUrl: getRequestURL(event).origin,
      apiKey: savoirConfig.apiKey || undefined,
      sessionId: existingSessionId || undefined,
      onToolCall: (info) => {
        const resultSummary = info.result
          ? ` [${info.result.success ? 'OK' : 'FAIL'}] (${info.result.durationMs}ms)`
          : ''
        log.info('chat', `[${requestId}] Tool call [${info.state}]: ${info.toolName}${resultSummary}`)

        if (streamWriter) {
          streamWriter.write({
            type: 'data-tool-call',
            id: info.toolCallId,
            data: {
              toolCallId: info.toolCallId,
              toolName: info.toolName,
              args: info.args,
              state: info.state,
              result: info.result,
            },
          })
        }
      },
    })

    const [routerConfig, agentConfigData] = await Promise.all([
      routeQuestion(messages, requestId),
      getAgentConfig(),
    ])

    const effectiveMaxSteps = Math.round(routerConfig.maxSteps * agentConfigData.maxStepsMultiplier)

    const effectiveModel = agentConfigData.defaultModel || model

    const dynamicSystemPrompt = buildDynamicSystemPrompt(agentConfigData)

    log.info('chat', `[${requestId}] Starting agent with ${effectiveModel} (routed: ${routerConfig.complexity}, ${effectiveMaxSteps} steps, multiplier: ${agentConfigData.maxStepsMultiplier}x)`)

    const requestStartTime = Date.now()

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        streamWriter = writer

        const agent = new ToolLoopAgent({
          model: effectiveModel,
          instructions: buildSystemPromptWithComplexity(dynamicSystemPrompt, routerConfig),
          tools: savoir.tools,
          stopWhen: stepCountIs(effectiveMaxSteps),
          onStepFinish: (stepResult) => {
            const stepDurationMs = Date.now() - stepStartTime
            stepDurations.push(stepDurationMs)
            stepCount++

            if (stepResult.usage) {
              totalInputTokens += stepResult.usage.inputTokens ?? 0
              totalOutputTokens += stepResult.usage.outputTokens ?? 0
            }

            if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
              toolCallCount += stepResult.toolCalls.length
              const tools = stepResult.toolCalls.map(c => c.toolName).join(', ')
              log.info('chat', `[${requestId}] Step ${stepCount}: ${tools} (${stepDurationMs}ms)`)
            } else {
              log.info('chat', `[${requestId}] Step ${stepCount}: response (${stepDurationMs}ms)`)
            }

            stepStartTime = Date.now()
          },
          onFinish: (result) => {
            const totalDurationMs = stepDurations.reduce((a, b) => a + b, 0)
            requestLog.set({
              finishReason: result.finishReason,
              totalInputTokens,
              totalOutputTokens,
              totalTokens: totalInputTokens + totalOutputTokens,
              stepCount,
              toolCallCount,
              stepDurations,
              totalAgentMs: totalDurationMs,
              routerComplexity: routerConfig.complexity,
              routerMaxSteps: routerConfig.maxSteps,
              effectiveMaxSteps,
              stepsMultiplier: agentConfigData.maxStepsMultiplier,
              routerReasoning: routerConfig.reasoning,
            })
            log.info('chat', `[${requestId}] Finished: ${result.finishReason} (total: ${totalDurationMs}ms)`)
          },
        })

        if (!chat.title && messages[0]) {
          generateTitle({
            firstMessage: messages[0],
            chatId: id as string,
            requestId,
            writer,
          })
        }

        const result = await agent.stream({ messages: await convertToModelMessages(messages) })
        writer.merge(result.toUIMessageStream())
      },
      onFinish: async ({ messages: responseMessages }) => {
        const dbStartTime = Date.now()
        const totalDurationMs = Date.now() - requestStartTime

        await db.insert(schema.messages).values(responseMessages.map((message: UIMessage) => ({
          id: message.id,
          chatId: chat.id,
          role: message.role as 'user' | 'assistant',
          parts: message.parts,
          ...(message.role === 'assistant' && {
            model: effectiveModel,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            durationMs: totalDurationMs,
          }),
        })))
        const dbDurationMs = Date.now() - dbStartTime

        const currentSessionId = savoir.getSessionId()
        if (currentSessionId) {
          await kv.set(KV_KEYS.ACTIVE_SANDBOX_SESSION, currentSessionId)
        }

        requestLog.set({
          outcome: 'success',
          responseMessageCount: responseMessages.length,
          dbInsertMs: dbDurationMs,
          totalDurationMs,
        })
      },
    })

    return createUIMessageStreamResponse({ stream })
  } catch (error) {
    requestLog.error(error instanceof Error ? error : new Error(String(error)))
    requestLog.set({ outcome: 'error' })
    throw error
  }
})
