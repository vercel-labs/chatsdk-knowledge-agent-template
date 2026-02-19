import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { kv } from '@nuxthub/kv'
import { and, eq } from 'drizzle-orm'
import { createSavoir } from '@savoir/sdk'
import { log, useLogger } from 'evlog'
import { createSourceAgent, createAdminAgent } from '@savoir/agent'
import type { RoutingResult } from '@savoir/agent'
import { generateTitle } from '../../utils/chat/generate-title'
import { getAgentConfig } from '../../utils/agent-config'
import { KV_KEYS } from '../../utils/sandbox/types'
import { adminTools } from '../../utils/chat/admin-tools'

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
      with: { messages: true },
    })
    if (!chat) {
      requestLog.error(new Error('Chat not found'))
      requestLog.set({ outcome: 'error' })
      throw createError({ statusCode: 404, statusMessage: 'Chat not found', data: { why: 'No chat exists with this ID for your user account', fix: 'Verify the chat ID is correct' } })
    }
    requestLog.set({ existingMessages: chat.messages.length, chatMode: chat.mode })

    const isAdminChat = chat.mode === 'admin'

    if (isAdminChat && user.role !== 'admin') {
      throw createError({ statusCode: 403, statusMessage: 'Admin access required', data: { why: 'This chat is in admin mode and requires the admin role', fix: 'Contact an administrator to be granted access' } })
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

    const config = useRuntimeConfig()

    let stepCount = 0
    let toolCallCount = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let stepStartTime = Date.now()
    const stepDurations: number[] = []
    let routingResult: RoutingResult | undefined
    let effectiveModel = model

    const existingSessionId = await kv.get<string>(KV_KEYS.ACTIVE_SANDBOX_SESSION)
    if (existingSessionId) {
      log.info('chat', `[${requestId}] Found active sandbox session ${existingSessionId}`)
    }

    const cookie = getHeader(event, 'cookie')
    const savoir = createSavoir({
      apiUrl: getRequestURL(event).origin,
      apiKey: config.savoir?.apiKey || undefined,
      headers: cookie ? { cookie } : undefined,
      sessionId: existingSessionId || undefined,
    })

    const onStepFinish = (stepResult: { usage?: { inputTokens?: number; outputTokens?: number }; toolCalls?: { toolName: string }[] }) => {
      const stepDurationMs = Date.now() - stepStartTime
      stepDurations.push(stepDurationMs)
      stepCount++

      if (stepResult.usage) {
        totalInputTokens += stepResult.usage.inputTokens ?? 0
        totalOutputTokens += stepResult.usage.outputTokens ?? 0
      }

      if (stepResult.toolCalls?.length) {
        toolCallCount += stepResult.toolCalls.length
        const tools = stepResult.toolCalls.map(c => c.toolName).join(', ')
        log.info('chat', `[${requestId}] Step ${stepCount}: ${tools} (${stepDurationMs}ms)`)
      } else {
        log.info('chat', `[${requestId}] Step ${stepCount}: response (${stepDurationMs}ms)`)
      }

      stepStartTime = Date.now()
    }

    const onFinish = (result: { finishReason: string }) => {
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
        ...(routingResult && {
          routerComplexity: routingResult.routerConfig.complexity,
          routerMaxSteps: routingResult.routerConfig.maxSteps,
          effectiveMaxSteps: routingResult.effectiveMaxSteps,
          stepsMultiplier: routingResult.agentConfig.maxStepsMultiplier,
          routerReasoning: routingResult.routerConfig.reasoning,
        }),
      })
      log.info('chat', `[${requestId}] Finished: ${result.finishReason} (total: ${totalDurationMs}ms)`)
    }

    const agent = isAdminChat
      ? createAdminAgent({
        tools: adminTools,
        onStepFinish,
        onFinish,
      })
      : createSourceAgent({
        tools: savoir.tools,
        getAgentConfig,
        messages,
        apiKey: config.savoir?.apiKey ?? '',
        defaultModel: model,
        requestId,
        onRouted: ({ routerConfig, agentConfig, effectiveModel: routedModel, effectiveMaxSteps }) => {
          effectiveModel = routedModel
          routingResult = { routerConfig, agentConfig, effectiveModel: routedModel, effectiveMaxSteps }
          log.info('chat', `[${requestId}] Starting agent [${chat.mode}] with ${effectiveModel} (routed: ${routerConfig.complexity}, ${effectiveMaxSteps} steps, multiplier: ${agentConfig.maxStepsMultiplier}x)`)
        },
        onStepFinish,
        onFinish,
      })

    const requestStartTime = Date.now()

    const abortController = new AbortController()
    event.node.res.once('close', () => {
      if (!event.node.res.writableFinished) {
        log.info('chat', `[${requestId}] Client disconnected, aborting agent`)
        abortController.abort()
      }
    })

    const titleTask = (!chat.title && messages[0])
      ? generateTitle({
        firstMessage: messages[0],
        chatId: id as string,
        requestId,
        apiKey: config.savoir?.apiKey ?? '',
      })
      : null

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const result = await agent.stream({
          messages: await convertToModelMessages(messages),
          options: {},
          abortSignal: abortController.signal,
        })
        writer.merge(result.toUIMessageStream())

        const title = await titleTask
        if (title) {
          writer.write({ type: 'data-chat-title', data: { title }, transient: true })
        }
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
