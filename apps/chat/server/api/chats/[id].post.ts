import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, stepCountIs, ToolLoopAgent, type UIMessage } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { kv } from '@nuxthub/kv'
import { and, eq } from 'drizzle-orm'
import { createSavoir } from '@savoir/sdk'
import { log, useLogger } from 'evlog'
import { generateTitle } from '../../utils/chat/generate-title'
import { routeQuestion } from '../../utils/router/route-question'
import { getAgentConfig } from '../../utils/agent-config'
import { KV_KEYS } from '../../utils/sandbox/types'
import { adminTools } from '../../utils/chat/admin-tools'
import { ADMIN_SYSTEM_PROMPT, buildChatSystemPrompt } from '../../utils/prompts/chat'
import { applyComplexity } from '../../utils/prompts/shared'

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
    const { user } = await requireUserSession(event)
    requestLog.set({ userId: user.id })

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
        eq(schema.chats.userId, user.id),
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
    requestLog.set({ existingMessages: chat.messages.length, chatMode: chat.mode })

    const isAdminChat = chat.mode === 'admin'

    if (isAdminChat && user.role !== 'admin') {
      throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
    }

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

    const cookie = getHeader(event, 'cookie')
    const savoir = createSavoir({
      apiUrl: getRequestURL(event).origin,
      apiKey: savoirConfig.apiKey || undefined,
      headers: cookie ? { cookie } : undefined,
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

    const effectiveMaxSteps = isAdminChat
      ? 15 // Admin tools are faster, fewer steps needed
      : Math.round(routerConfig.maxSteps * agentConfigData.maxStepsMultiplier)

    const effectiveModel = agentConfigData.defaultModel || model

    const dynamicSystemPrompt = isAdminChat
      ? ADMIN_SYSTEM_PROMPT
      : buildChatSystemPrompt(agentConfigData)

    const effectiveTools = isAdminChat ? adminTools : savoir.tools

    log.info('chat', `[${requestId}] Starting agent [${chat.mode}] with ${effectiveModel} (routed: ${routerConfig.complexity}, ${effectiveMaxSteps} steps, multiplier: ${agentConfigData.maxStepsMultiplier}x)`)

    const requestStartTime = Date.now()

    // Abort the agent when the client disconnects (e.g. chat.stop())
    const abortController = new AbortController()
    event.node.res.once('close', () => {
      // Only abort if the response didn't finish normally (i.e. client disconnected)
      if (!event.node.res.writableFinished) {
        log.info('chat', `[${requestId}] Client disconnected, aborting agent`)
        abortController.abort()
      }
    })

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        streamWriter = writer

        const agent = new ToolLoopAgent({
          model: effectiveModel,
          instructions: isAdminChat ? dynamicSystemPrompt : applyComplexity(dynamicSystemPrompt, routerConfig),
          tools: effectiveTools,
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

              // Emit tool call events for admin tools (SDK tools handle this via onToolCall)
              if (isAdminChat && streamWriter) {
                for (const tc of stepResult.toolCalls) {
                  streamWriter.write({
                    type: 'data-tool-call',
                    id: tc.toolCallId,
                    data: {
                      toolCallId: tc.toolCallId,
                      toolName: tc.toolName,
                      args: tc.args,
                      state: 'done',
                      result: {
                        success: true,
                        durationMs: stepDurationMs,
                        commands: [],
                      },
                    },
                  })
                }
              }
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

        const result = await agent.stream({
          messages: await convertToModelMessages(messages),
          abortSignal: abortController.signal,
        })
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

        if (!isAdminChat) {
          const currentSessionId = savoir.getSessionId()
          if (currentSessionId) {
            await kv.set(KV_KEYS.ACTIVE_SANDBOX_SESSION, currentSessionId)
          }
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
