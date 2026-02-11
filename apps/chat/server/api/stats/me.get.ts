import { db, schema } from '@nuxthub/db'
import { eq, and, isNotNull } from 'drizzle-orm'
import type { UserStats } from '../../../shared/types/stats'

/**
 * GET /api/stats/me
 * Get current user's usage statistics
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const userId = user.id

  // Get all chats for this user
  const userChats = await db
    .select({ id: schema.chats.id })
    .from(schema.chats)
    .where(eq(schema.chats.userId, userId))

  if (userChats.length === 0) {
    return {
      totalMessages: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalDurationMs: 0,
      modelsUsed: [],
    } satisfies UserStats
  }

  const chatIds = userChats.map(c => c.id)

  // Get all assistant messages with stats for user's chats
  const messagesWithStats = await db
    .select({
      model: schema.messages.model,
      inputTokens: schema.messages.inputTokens,
      outputTokens: schema.messages.outputTokens,
      durationMs: schema.messages.durationMs,
    })
    .from(schema.messages)
    .where(
      and(
        isNotNull(schema.messages.model),
        // Filter by chat IDs - using SQL IN
        chatIds.length === 1
          ? eq(schema.messages.chatId, chatIds[0]!)
          : undefined // Will need to handle multiple chats differently
      )
    )

  // For multiple chats, we need to filter in JS since drizzle doesn't have a nice IN helper
  const filteredMessages = chatIds.length > 1
    ? await db
      .select({
        chatId: schema.messages.chatId,
        model: schema.messages.model,
        inputTokens: schema.messages.inputTokens,
        outputTokens: schema.messages.outputTokens,
        durationMs: schema.messages.durationMs,
      })
      .from(schema.messages)
      .where(isNotNull(schema.messages.model))
      .then(msgs => msgs.filter(m => chatIds.includes(m.chatId)))
    : messagesWithStats

  // Calculate totals
  let totalMessages = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalDurationMs = 0
  const modelsSet = new Set<string>()

  for (const msg of filteredMessages) {
    if (!msg.model) continue

    totalMessages++
    totalInputTokens += msg.inputTokens ?? 0
    totalOutputTokens += msg.outputTokens ?? 0
    totalDurationMs += msg.durationMs ?? 0
    modelsSet.add(msg.model)
  }

  return {
    totalMessages,
    totalInputTokens,
    totalOutputTokens,
    totalDurationMs,
    modelsUsed: Array.from(modelsSet),
  } satisfies UserStats
})
