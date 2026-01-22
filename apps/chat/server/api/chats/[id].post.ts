import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, ToolLoopAgent, type UIMessage } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { createSavoir } from '@savoir/sdk'
import { getLogger } from '@savoir/logger'
import { generateTitle } from '../../utils/generate-title'

const SYSTEM_PROMPT = `You are an AI assistant specialized in the Nuxt/Nitro ecosystem.

## CRITICAL: Documentation First

Your knowledge may be outdated. ONLY answer based on what you find in the documentation.
- If you can't find information in the docs, say "I couldn't find this in the documentation"
- NEVER make up information or guess - only state what you found in docs
- NEVER mention package versions unless you verified them in the docs

## Tools

You have access to documentation search tools:

- **search_and_read**: Search AND read files in one step (PREFERRED - faster and more efficient)
- **read**: Read specific files by path (use when you already know the exact file path)

## How to Search Effectively

1. **Use ONE simple keyword**: "composables" ✓, "vue composables usage" ✗
2. **Always prefer search_and_read** - it's faster and returns content directly
3. **Search by concept**: "middleware", "plugins", "routing", "state", "data-fetching"
4. **Search by package/module name**: "unstorage", "ofetch", "nitro", "h3", "unhead"

## Workflow

1. User asks a question
2. Call **search_and_read** with a relevant keyword
3. Read the results and find the answer
4. If not found, try different keywords or broader terms
5. Answer based ONLY on what you found in the documentation

## Response Style

- Be concise and helpful
- Include relevant code examples from the docs
- Use markdown formatting
- Cite the source file when quoting documentation
`

defineRouteMeta({
  openAPI: {
    description: 'Chat with AI about Nuxt documentation.',
    tags: ['ai'],
  },
})

export default defineEventHandler(async (event) => {
  const logger = getLogger()
  const requestId = crypto.randomUUID().slice(0, 8)

  const log = logger.request({
    requestId,
    path: '/api/chats/[id]',
    method: 'POST',
  })

  try {
    const session = await getUserSession(event)
    log.set({ userId: session.user?.id || session.id })

    const { id } = await getValidatedRouterParams(event, z.object({
      id: z.string(),
    }).parse)
    log.set({ chatId: id })

    const { model, messages } = await readValidatedBody(event, z.object({
      model: z.string(),
      messages: z.array(z.custom<UIMessage>()),
    }).parse)
    log.set({ model, messageCount: messages.length })

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
      log.error('Chat not found')
      log.emit({ outcome: 'error' })
      throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
    }
    log.set({ existingMessages: chat.messages.length })

    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'user' && messages.length > 1) {
      await db.insert(schema.messages).values({
        chatId: id as string,
        role: 'user',
        parts: lastMessage.parts,
      })
    }

    const { savoir: savoirConfig } = useRuntimeConfig()
    const savoir = createSavoir({
      apiUrl: savoirConfig.apiUrl,
      apiKey: savoirConfig.apiKey || undefined,
    })

    let stepCount = 0
    let toolCallCount = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0

    logger.log('chat', `[${requestId}] Starting agent with ${model}`)

    const agent = new ToolLoopAgent({
      model,
      instructions: SYSTEM_PROMPT,
      tools: savoir.tools,
      onStepFinish: (stepResult) => {
        stepCount++

        if (stepResult.usage) {
          totalInputTokens += stepResult.usage.inputTokens ?? 0
          totalOutputTokens += stepResult.usage.outputTokens ?? 0
        }

        if (stepResult.toolCalls && stepResult.toolCalls.length > 0) {
          toolCallCount += stepResult.toolCalls.length
          const tools = stepResult.toolCalls.map(c => c.toolName).join(', ')
          logger.log('chat', `[${requestId}] Step ${stepCount}: ${tools}`)
        }
      },

      onFinish: (result) => {
        log.set({
          finishReason: result.finishReason,
          totalInputTokens,
          totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
          stepCount,
          toolCallCount,
        })
        logger.log('chat', `[${requestId}] Finished: ${result.finishReason}`)
      },
    })

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
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

        log.set({
          outcome: 'success',
          responseMessageCount: responseMessages.length,
          dbInsertMs: dbDurationMs,
        })

        log.emit()
      },
    })

    return createUIMessageStreamResponse({ stream })
  } catch (error) {
    log.error(error instanceof Error ? error : new Error(String(error)))
    log.emit({ outcome: 'error' })
    throw error
  }
})
