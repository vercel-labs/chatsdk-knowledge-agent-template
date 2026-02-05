import { db, schema } from '@nuxthub/db'
import { desc, and, gte, lt, eq, countDistinct } from 'drizzle-orm'

/**
 * GET /api/stats
 * Get global usage statistics (admin only)
 *
 * Query params:
 * - days: number of days to look back (default: 30)
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = getQuery(event)
  const days = Math.min(Math.max(Number(query.days) || 30, 1), 365)

  // Current period
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Previous period (for trends comparison)
  const prevEndDate = new Date(startDate)
  const prevStartDate = new Date(startDate)
  prevStartDate.setDate(prevStartDate.getDate() - days)

  // Fetch current period messages
  const messagesWithStats = await db
    .select({
      chatId: schema.messages.chatId,
      model: schema.messages.model,
      inputTokens: schema.messages.inputTokens,
      outputTokens: schema.messages.outputTokens,
      durationMs: schema.messages.durationMs,
      feedback: schema.messages.feedback,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .where(
      and(
        eq(schema.messages.role, 'assistant'),
        gte(schema.messages.createdAt, startDate),
      ),
    )
    .orderBy(desc(schema.messages.createdAt))

  // Fetch previous period messages (for trends)
  const prevMessagesWithStats = await db
    .select({
      chatId: schema.messages.chatId,
      inputTokens: schema.messages.inputTokens,
      outputTokens: schema.messages.outputTokens,
    })
    .from(schema.messages)
    .where(
      and(
        eq(schema.messages.role, 'assistant'),
        gte(schema.messages.createdAt, prevStartDate),
        lt(schema.messages.createdAt, prevEndDate),
      ),
    )

  // Get chat -> user mapping for user stats
  const chatIds = [...new Set(messagesWithStats.map(m => m.chatId))]
  const chatsData = chatIds.length > 0
    ? await db
      .select({
        id: schema.chats.id,
        userId: schema.chats.userId,
      })
      .from(schema.chats)
    : []

  const chatUserMap = new Map<string, string>()
  for (const chat of chatsData) {
    if (chatIds.includes(chat.id)) {
      chatUserMap.set(chat.id, chat.userId)
    }
  }

  // Get user info for top users
  const userIds = [...new Set(chatUserMap.values())]
  const usersData = userIds.length > 0
    ? await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        avatar: schema.users.avatar,
      })
      .from(schema.users)
    : []

  const userInfoMap = new Map<string, { name: string, email: string, avatar: string }>()
  for (const user of usersData) {
    if (userIds.includes(user.id)) {
      userInfoMap.set(user.id, { name: user.name, email: user.email, avatar: user.avatar })
    }
  }

  // Count active users in previous period for trend
  const prevChatIds = [...new Set(prevMessagesWithStats.map(m => m.chatId))]
  const prevChatsData = prevChatIds.length > 0
    ? await db
      .select({ id: schema.chats.id, userId: schema.chats.userId })
      .from(schema.chats)
    : []
  const prevUserIds = new Set<string>()
  for (const chat of prevChatsData) {
    if (prevChatIds.includes(chat.id)) {
      prevUserIds.add(chat.userId)
    }
  }

  const apiUsageData = await db
    .select({
      source: schema.apiUsage.source,
      model: schema.apiUsage.model,
      inputTokens: schema.apiUsage.inputTokens,
      outputTokens: schema.apiUsage.outputTokens,
      durationMs: schema.apiUsage.durationMs,
      createdAt: schema.apiUsage.createdAt,
    })
    .from(schema.apiUsage)
    .where(gte(schema.apiUsage.createdAt, startDate))
    .orderBy(desc(schema.apiUsage.createdAt))

  let totalMessages = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalDurationMs = 0
  let messagesWithDuration = 0
  let positiveFeedback = 0
  let negativeFeedback = 0

  const byModelMap = new Map<string, {
    messageCount: number
    inputTokens: number
    outputTokens: number
    totalDurationMs: number
    positive: number
    negative: number
  }>()

  const dailyMap = new Map<string, Map<string, {
    messageCount: number
    inputTokens: number
    outputTokens: number
    totalDurationMs: number
  }>>()

  const bySourceMap = new Map<string, {
    requests: number
    inputTokens: number
    outputTokens: number
    totalDurationMs: number
  }>()

  // User stats aggregation
  const byUserMap = new Map<string, {
    messageCount: number
    inputTokens: number
    outputTokens: number
    totalDurationMs: number
  }>()

  bySourceMap.set('web', { requests: 0, inputTokens: 0, outputTokens: 0, totalDurationMs: 0 })

  for (const msg of messagesWithStats) {
    totalMessages++
    totalInputTokens += msg.inputTokens ?? 0
    totalOutputTokens += msg.outputTokens ?? 0

    if (msg.durationMs && msg.durationMs > 0) {
      totalDurationMs += msg.durationMs
      messagesWithDuration++
    }

    if (msg.feedback === 'positive') positiveFeedback++
    if (msg.feedback === 'negative') negativeFeedback++

    const modelKey = msg.model ?? 'unknown'
    const modelStats = byModelMap.get(modelKey) ?? { messageCount: 0, inputTokens: 0, outputTokens: 0, totalDurationMs: 0, positive: 0, negative: 0 }
    modelStats.messageCount++
    modelStats.inputTokens += msg.inputTokens ?? 0
    modelStats.outputTokens += msg.outputTokens ?? 0
    modelStats.totalDurationMs += msg.durationMs ?? 0
    if (msg.feedback === 'positive') modelStats.positive++
    if (msg.feedback === 'negative') modelStats.negative++
    byModelMap.set(modelKey, modelStats)

    const dateStr = msg.createdAt.toISOString().split('T')[0]!
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, new Map())
    }
    const dayModelMap = dailyMap.get(dateStr)!
    const dayModelStats = dayModelMap.get(modelKey) ?? {
      messageCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalDurationMs: 0,
    }
    dayModelStats.messageCount++
    dayModelStats.inputTokens += msg.inputTokens ?? 0
    dayModelStats.outputTokens += msg.outputTokens ?? 0
    dayModelStats.totalDurationMs += msg.durationMs ?? 0
    dayModelMap.set(modelKey, dayModelStats)

    const webStats = bySourceMap.get('web')!
    webStats.requests++
    webStats.inputTokens += msg.inputTokens ?? 0
    webStats.outputTokens += msg.outputTokens ?? 0
    webStats.totalDurationMs += msg.durationMs ?? 0

    // Aggregate by user
    const userId = chatUserMap.get(msg.chatId)
    if (userId) {
      const userStats = byUserMap.get(userId) ?? { messageCount: 0, inputTokens: 0, outputTokens: 0, totalDurationMs: 0 }
      userStats.messageCount++
      userStats.inputTokens += msg.inputTokens ?? 0
      userStats.outputTokens += msg.outputTokens ?? 0
      userStats.totalDurationMs += msg.durationMs ?? 0
      byUserMap.set(userId, userStats)
    }
  }

  for (const usage of apiUsageData) {
    const { source } = usage
    const sourceStats = bySourceMap.get(source) ?? { requests: 0, inputTokens: 0, outputTokens: 0, totalDurationMs: 0 }
    sourceStats.requests++
    sourceStats.inputTokens += usage.inputTokens ?? 0
    sourceStats.outputTokens += usage.outputTokens ?? 0
    sourceStats.totalDurationMs += usage.durationMs ?? 0
    bySourceMap.set(source, sourceStats)

    totalMessages++
    totalInputTokens += usage.inputTokens ?? 0
    totalOutputTokens += usage.outputTokens ?? 0
    if (usage.durationMs && usage.durationMs > 0) {
      totalDurationMs += usage.durationMs
      messagesWithDuration++
    }

    const modelKey = usage.model ?? 'unknown'
    const modelStats = byModelMap.get(modelKey) ?? { messageCount: 0, inputTokens: 0, outputTokens: 0, totalDurationMs: 0, positive: 0, negative: 0 }
    modelStats.messageCount++
    modelStats.inputTokens += usage.inputTokens ?? 0
    modelStats.outputTokens += usage.outputTokens ?? 0
    modelStats.totalDurationMs += usage.durationMs ?? 0
    byModelMap.set(modelKey, modelStats)
  }

  // Calculate previous period totals for trends
  const prevTotalMessages = prevMessagesWithStats.length
  let prevTotalTokens = 0
  for (const msg of prevMessagesWithStats) {
    prevTotalTokens += (msg.inputTokens ?? 0) + (msg.outputTokens ?? 0)
  }

  // Calculate trend percentages
  function calcTrend(current: number, previous: number): number | null {
    if (previous === 0) return current > 0 ? 100 : null
    return Math.round(((current - previous) / previous) * 100)
  }

  const byModel = Array.from(byModelMap.entries())
    .filter(([model]) => model !== 'unknown')
    .map(([model, stats]) => ({
      model,
      messageCount: stats.messageCount,
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      avgDurationMs: stats.messageCount > 0 ? Math.round(stats.totalDurationMs / stats.messageCount) : 0,
      positive: stats.positive,
      negative: stats.negative,
    }))
    .sort((a, b) => b.messageCount - a.messageCount)

  const bySource = Array.from(bySourceMap.entries())
    .filter(([, stats]) => stats.requests > 0)
    .map(([source, stats]) => ({
      source,
      requests: stats.requests,
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      totalTokens: stats.inputTokens + stats.outputTokens,
      avgDurationMs: stats.requests > 0 ? Math.round(stats.totalDurationMs / stats.requests) : 0,
    }))
    .sort((a, b) => b.requests - a.requests)

  // Top users by message count
  const topUsers = Array.from(byUserMap.entries())
    .map(([userId, stats]) => {
      const userInfo = userInfoMap.get(userId)
      return {
        userId,
        name: userInfo?.name ?? 'Unknown',
        email: userInfo?.email ?? '',
        avatar: userInfo?.avatar ?? '',
        ...stats,
        totalTokens: stats.inputTokens + stats.outputTokens,
      }
    })
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 10)

  const activeUsers = byUserMap.size
  const prevActiveUsers = prevUserIds.size

  const daily = Array.from(dailyMap.entries())
    .flatMap(([date, modelMap]) =>
      Array.from(modelMap.entries()).map(([model, stats]) => ({
        date,
        model,
        messageCount: stats.messageCount,
        inputTokens: stats.inputTokens,
        outputTokens: stats.outputTokens,
        avgDurationMs: stats.messageCount > 0 ? Math.round(stats.totalDurationMs / stats.messageCount) : 0,
      })),
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  // Daily totals for message trend chart
  const dailyTotals = Array.from(dailyMap.entries())
    .map(([date, modelMap]) => {
      let messages = 0
      let tokens = 0
      for (const stats of modelMap.values()) {
        messages += stats.messageCount
        tokens += stats.inputTokens + stats.outputTokens
      }
      return { date, messages, tokens }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const totalFeedback = positiveFeedback + negativeFeedback
  const feedbackScore = totalFeedback > 0 ? Math.round((positiveFeedback / totalFeedback) * 100) : null

  return {
    period: {
      days,
      from: startDate.toISOString().split('T')[0]!,
      to: endDate.toISOString().split('T')[0]!,
    },
    totals: {
      messages: totalMessages,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      avgDurationMs: messagesWithDuration > 0 ? Math.round(totalDurationMs / messagesWithDuration) : 0,
      activeUsers,
    },
    trends: {
      messages: calcTrend(totalMessages, prevTotalMessages),
      tokens: calcTrend(totalInputTokens + totalOutputTokens, prevTotalTokens),
      activeUsers: calcTrend(activeUsers, prevActiveUsers),
    },
    feedback: {
      positive: positiveFeedback,
      negative: negativeFeedback,
      total: totalFeedback,
      score: feedbackScore,
    },
    byModel,
    bySource,
    topUsers,
    daily,
    dailyTotals,
  }
})
