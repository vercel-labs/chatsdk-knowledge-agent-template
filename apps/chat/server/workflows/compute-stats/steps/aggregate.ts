/**
 * Step: Aggregate Stats
 *
 * Aggregates message statistics for a specific date into the usage_stats table.
 */

import { getStepMetadata, RetryableError } from 'workflow'
import { log } from 'evlog'
import { db, schema } from '@nuxthub/db'
import { and, gte, lt, isNotNull, isNull, eq } from 'drizzle-orm'
import type { AggregatedStats, ComputeStatsResult } from '../types'

export async function stepAggregateStats(date: string): Promise<ComputeStatsResult> {
  'use step'

  const { stepId, attempt } = getStepMetadata()
  log.info('stats', `[${stepId}] Computing stats for ${date} (attempt ${attempt})`)

  try {
    // Parse date boundaries
    const startDate = new Date(`${date}T00:00:00.000Z`)
    const endDate = new Date(`${date}T23:59:59.999Z`)

    // Get all assistant messages with stats for this date
    const messagesWithStats = await db
      .select({
        chatId: schema.messages.chatId,
        model: schema.messages.model,
        inputTokens: schema.messages.inputTokens,
        outputTokens: schema.messages.outputTokens,
        durationMs: schema.messages.durationMs,
      })
      .from(schema.messages)
      .where(
        and(
          isNotNull(schema.messages.model),
          gte(schema.messages.createdAt, startDate),
          lt(schema.messages.createdAt, endDate),
        ),
      )

    if (messagesWithStats.length === 0) {
      log.info('stats', `[${stepId}] No messages found for ${date}`)
      return {
        success: true,
        date,
        statsCreated: 0,
        userStats: 0,
        globalStats: 0,
      }
    }

    log.info('stats', `[${stepId}] Found ${messagesWithStats.length} messages to aggregate`)

    // Get chat -> user mapping
    const chatIds = [...new Set(messagesWithStats.map(m => m.chatId))]
    const chats = await db
      .select({ id: schema.chats.id, userId: schema.chats.userId })
      .from(schema.chats)
      .where(
        chatIds.length === 1
          ? eq(schema.chats.id, chatIds[0]!)
          : undefined, // Will filter in JS for multiple
      )

    const chatUserMap = new Map<string, string>()
    for (const chat of chats) {
      if (chatIds.includes(chat.id)) {
        chatUserMap.set(chat.id, chat.userId)
      }
    }

    // Aggregate by userId + model
    const userModelMap = new Map<string, AggregatedStats>()
    const globalModelMap = new Map<string, AggregatedStats>()

    for (const msg of messagesWithStats) {
      if (!msg.model)
        continue

      const userId = chatUserMap.get(msg.chatId) ?? null
      const inputTokens = msg.inputTokens ?? 0
      const outputTokens = msg.outputTokens ?? 0
      const durationMs = msg.durationMs ?? 0

      // User stats
      if (userId) {
        const userKey = `${userId}:${msg.model}`
        const userStats = userModelMap.get(userKey) ?? {
          userId,
          model: msg.model,
          messageCount: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalDurationMs: 0,
        }
        userStats.messageCount++
        userStats.totalInputTokens += inputTokens
        userStats.totalOutputTokens += outputTokens
        userStats.totalDurationMs += durationMs
        userModelMap.set(userKey, userStats)
      }

      // Global stats (userId = null)
      const globalKey = msg.model
      const globalStats = globalModelMap.get(globalKey) ?? {
        userId: null,
        model: msg.model,
        messageCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalDurationMs: 0,
      }
      globalStats.messageCount++
      globalStats.totalInputTokens += inputTokens
      globalStats.totalOutputTokens += outputTokens
      globalStats.totalDurationMs += durationMs
      globalModelMap.set(globalKey, globalStats)
    }

    // Upsert into usage_stats table
    const allStats = [...userModelMap.values(), ...globalModelMap.values()]

    for (const stats of allStats) {
      // Check if record exists
      const existing = await db
        .select()
        .from(schema.usageStats)
        .where(
          and(
            eq(schema.usageStats.date, date),
            stats.userId
              ? eq(schema.usageStats.userId, stats.userId)
              : isNull(schema.usageStats.userId),
            eq(schema.usageStats.model, stats.model),
          ),
        )
        .limit(1)

      if (existing.length > 0) {
        // Update existing record
        await db
          .update(schema.usageStats)
          .set({
            messageCount: stats.messageCount,
            totalInputTokens: stats.totalInputTokens,
            totalOutputTokens: stats.totalOutputTokens,
            totalDurationMs: stats.totalDurationMs,
          })
          .where(eq(schema.usageStats.id, existing[0]!.id))
      } else {
        // Insert new record
        await db.insert(schema.usageStats).values({
          date,
          userId: stats.userId,
          model: stats.model,
          messageCount: stats.messageCount,
          totalInputTokens: stats.totalInputTokens,
          totalOutputTokens: stats.totalOutputTokens,
          totalDurationMs: stats.totalDurationMs,
        })
      }
    }

    const userStatsCount = userModelMap.size
    const globalStatsCount = globalModelMap.size

    log.info('stats', `[${stepId}] Created ${allStats.length} stats records (${userStatsCount} user, ${globalStatsCount} global)`)

    return {
      success: true,
      date,
      statsCreated: allStats.length,
      userStats: userStatsCount,
      globalStats: globalStatsCount,
    }
  } catch (error) {
    // Retry on database connection errors
    if (error instanceof Error && (error.message.includes('SQLITE_BUSY') || error.message.includes('ECONNRESET'))) {
      throw new RetryableError(`Database error: ${error.message}`, {
        retryAfter: attempt * 1000, // Exponential backoff
      })
    }
    throw error
  }
}

// Allow retries for database operations
stepAggregateStats.maxRetries = 3
