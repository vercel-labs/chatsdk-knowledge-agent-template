import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText, type UIMessage } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { kv } from '@nuxthub/kv'
import { and, eq } from 'drizzle-orm'
import { createSavoir } from '@savoir/sdk'
import { log, useLogger } from 'evlog'
import { generateTitle } from '../../utils/chat/generate-title'
import { routeQuestion } from '../../utils/router/route-question'
import { KV_KEYS } from '../../utils/sandbox/types'
import { adminTools } from '../../utils/chat/admin-tools'
import { ADMIN_SYSTEM_PROMPT, buildChatSystemPrompt } from '../../utils/prompts/chat'
import { applyComplexity } from '../../utils/prompts/shared'
import { createAgent, type RoutingResult } from '../../utils/create-agent'

defineRouteMeta({
  openAPI: {
    description: 'Chat with AI about the available sources.',
    tags: ['ai'],
  },
})

/** Build a short title for the collapsed tool call header. */
function adminToolTitle(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'run_sql': return 'SQL query'
    case 'query_stats': return 'Query stats'
    case 'list_users': return 'List users'
    case 'list_sources': return 'List sources'
    case 'query_chats': return 'Query chats'
    case 'get_agent_config': return 'Get agent config'
    case 'query_logs': {
      const filters = [args.level, args.method, args.path, args.status].filter(Boolean)
      return filters.length ? `Query logs (${filters.join(', ')})` : 'Query logs'
    }
    case 'log_stats': return `Log stats (${args.hours || 24}h)`
    case 'query_errors': return `Query errors (${args.hours || 24}h)`
    default: return toolName.replace(/_/g, ' ')
  }
}

/** Build a detailed command string shown in the expanded tool call. */
function adminToolCommand(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'run_sql': {
      const q = String(args?.query || '').trim()
      return q.length > 120 ? `${q.slice(0, 120)}…` : q || 'SQL query'
    }
    default: return Object.entries(args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ') || toolName.replace(/_/g, ' ')
  }
}

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

    const config = useRuntimeConfig()

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
      apiKey: config.savoir?.apiKey || undefined,
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

    let routingResult: RoutingResult | undefined
    let effectiveModel = model

    // Wrap admin tools to emit loading/done events using the same format as SDK tools.
    // Exclude 'chart' which has its own native UI via tool-chart parts.
    const wrappedAdminTools = isAdminChat
      ? Object.fromEntries(
        Object.entries(adminTools).map(([name, t]) => {
          if (name === 'chart') return [name, t]
          return [
            name,
            {
              ...(t as Record<string, unknown>),
              execute: (args: Record<string, unknown>, options: { toolCallId: string }) => {
                const title = adminToolTitle(name, args)
                const command = adminToolCommand(name, args)

                // Emit loading event (same shape as SDK tools)
                if (streamWriter) {
                  streamWriter.write({
                    type: 'data-tool-call',
                    id: options.toolCallId,
                    data: {
                      toolCallId: options.toolCallId,
                      toolName: name,
                      args: { command: title },
                      state: 'loading',
                    },
                  })
                }

                const start = Date.now()
                const promise = (t as any).execute(args, options) as Promise<unknown>

                // Emit done event with result as stdout (same shape as SDK tools)
                return promise.then((output: unknown) => {
                  if (streamWriter) {
                    streamWriter.write({
                      type: 'data-tool-call',
                      id: options.toolCallId,
                      data: {
                        toolCallId: options.toolCallId,
                        toolName: name,
                        args: { command: title },
                        state: 'done',
                        result: {
                          success: true,
                          durationMs: Date.now() - start,
                          commands: [
                            {
                              command,
                              stdout: JSON.stringify(output, null, 2),
                              stderr: '',
                              exitCode: 0,
                              success: true,
                            },
                          ],
                        },
                      },
                    })
                  }
                  return output
                })
              },
            },
          ]
        }),
      )
      : undefined

    const agent = createAgent({
      tools: savoir.tools,
      route: () => routeQuestion(messages, requestId),
      buildPrompt: (routerConfig, agentConfig) => applyComplexity(buildChatSystemPrompt(agentConfig), routerConfig),
      resolveModel: (_, agentConfig) => agentConfig.defaultModel || model,
      admin: wrappedAdminTools
        ? { tools: wrappedAdminTools, systemPrompt: ADMIN_SYSTEM_PROMPT }
        : undefined,
      onRouted: (routed) => {
        routingResult = routed
        const { effectiveModel: routedModel, effectiveMaxSteps, routerConfig, agentConfig } = routed
        effectiveModel = routedModel
        log.info('chat', `[${requestId}] Starting agent [${chat.mode}] with ${routedModel} (routed: ${routerConfig.complexity}, ${effectiveMaxSteps} steps, multiplier: ${agentConfig.maxStepsMultiplier}x)`)
      },
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
          const tools = stepResult.toolCalls.map((c: { toolName: string }) => c.toolName).join(', ')
          log.info('chat', `[${requestId}] Step ${stepCount}: ${tools} (${stepDurationMs}ms)`)

          // Admin tool call events (loading + done) are emitted from the tool wrapper itself,
          // so no additional emission is needed here.
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
          ...(routingResult && {
            routerComplexity: routingResult.routerConfig.complexity,
            routerMaxSteps: routingResult.routerConfig.maxSteps,
            effectiveMaxSteps: routingResult.effectiveMaxSteps,
            stepsMultiplier: routingResult.agentConfig.maxStepsMultiplier,
            routerReasoning: routingResult.routerConfig.reasoning,
          }),
        })
        log.info('chat', `[${requestId}] Finished: ${result.finishReason} (total: ${totalDurationMs}ms)`)
      },
    })

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

        // Fallback: if the agent exhausted all steps on tool calls without
        // producing any text, do one final call with NO tools to force a response.
        const agentText = await result.text
        if (!agentText?.trim()) {
          log.info('chat', `[${requestId}] Agent produced no text, forcing fallback response`)
          const agentResponse = await result.response
          const convertedMessages = await convertToModelMessages(messages)
          const fallback = streamText({
            model: effectiveModel,
            messages: [
              ...convertedMessages,
              ...agentResponse.messages,
            ],
            abortSignal: abortController.signal,
          })
          writer.merge(fallback.toUIMessageStream())
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
