import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, stepCountIs, ToolLoopAgent, type UIMessage } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { createSavoir } from '@savoir/sdk'
import { log, useLogger } from 'evlog'
import { generateTitle } from '../../utils/chat/generate-title'
import { routeQuestion, buildSystemPromptWithComplexity } from '../../utils/router/route-question'

const SYSTEM_PROMPT = `You are an AI assistant that answers questions based on the available sources.

## CRITICAL: Sources First

Your knowledge may be outdated. ONLY answer based on what you find in the sources.
- If you can't find information, say "I couldn't find this in the available sources"
- NEVER make up information or guess - only state what you found
- Always cite the source file when quoting content

## Search Strategy (IMPORTANT for speed)

1. **Explore first** - Start by discovering the available sources:
   \`\`\`bash
   ls /docs  # See what sources are available
   \`\`\`

2. **Target specific directories** - Don't search everything at once:
   \`\`\`bash
   ls /docs/[source]/  # Explore the structure
   grep -r "keyword" /docs/[source] --include="*.md" -l | head -10
   \`\`\`

3. **Use simple keywords**: one word is better than a phrase

## Workflow

1. User asks a question
2. Explore available sources with \`ls\`
3. Identify which source(s) are relevant
4. Search within those specific directories
5. Read the relevant files
6. Answer based ONLY on what you found

## Response Style

- Be concise and helpful
- Include relevant code examples when available
- Use markdown formatting
- Cite the source file path
`

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

    // Writer reference to be used by onToolCall callback
    let streamWriter: any = null

    const savoir = createSavoir({
      apiUrl: getRequestURL(event).origin,
      apiKey: savoirConfig.apiKey || undefined,
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

    const agentConfig = await routeQuestion(messages, requestId)

    log.info('chat', `[${requestId}] Starting agent with ${model} (routed: ${agentConfig.complexity}, ${agentConfig.maxSteps} steps)`)

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        streamWriter = writer

        const agent = new ToolLoopAgent({
          model,
          instructions: buildSystemPromptWithComplexity(SYSTEM_PROMPT, agentConfig),
          tools: savoir.tools,
          stopWhen: stepCountIs(agentConfig.maxSteps),
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

            // Reset timer for next step
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
              routerComplexity: agentConfig.complexity,
              routerMaxSteps: agentConfig.maxSteps,
              routerReasoning: agentConfig.reasoning,
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
        await db.insert(schema.messages).values(responseMessages.map((message: UIMessage) => ({
          chatId: chat.id,
          role: message.role as 'user' | 'assistant',
          parts: message.parts,
        })))
        const dbDurationMs = Date.now() - dbStartTime

        requestLog.set({
          outcome: 'success',
          responseMessageCount: responseMessages.length,
          dbInsertMs: dbDurationMs,
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
