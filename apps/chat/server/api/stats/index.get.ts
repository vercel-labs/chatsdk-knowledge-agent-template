import { db, schema } from '@nuxthub/db'
import { desc, and, gte, lt, eq } from 'drizzle-orm'

/**
 * GET /api/stats
 * Get global usage statistics (admin only)
 *
 * Query params:
 * - days: number of days to look back (default: 30)
 * - sources: comma-separated source filter (e.g. web,github-bot)
 * - models: comma-separated model filter
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = getQuery(event)
  const days = Math.min(Math.max(Number(query.days) || 30, 1), 365)
  const sourcesFilter = typeof query.sources === 'string' && query.sources ? query.sources.split(',') : null
  const modelsFilter = typeof query.models === 'string' && query.models ? query.models.split(',') : null

  // Current period
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Previous period (for trends comparison)
  const prevEndDate = new Date(startDate)
  const prevStartDate = new Date(startDate)
  prevStartDate.setDate(prevStartDate.getDate() - days)

  // Fetch all three independent data sources in parallel
  const [messagesWithStats, prevMessagesWithStats, apiUsageDataRaw] = await Promise.all([
    // Current period messages
    db
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
      .orderBy(desc(schema.messages.createdAt)),
    // Previous period messages (for trends)
    db
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
      ),
    // API usage data
    db
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
      .orderBy(desc(schema.apiUsage.createdAt)),
  ])

  // Get chat -> user mapping for user stats (depends on messagesWithStats)
  const chatIds = [...new Set(messagesWithStats.map(m => m.chatId))]
  // Get prev chat IDs for trend (depends on prevMessagesWithStats)
  const prevChatIds = [...new Set(prevMessagesWithStats.map(m => m.chatId))]

  // Fetch chats and prev chats in parallel (both independent from each other)
  const [chatsData, prevChatsData] = await Promise.all([
    chatIds.length > 0
      ? db.select({ id: schema.chats.id, userId: schema.chats.userId }).from(schema.chats)
      : Promise.resolve([]),
    prevChatIds.length > 0
      ? db.select({ id: schema.chats.id, userId: schema.chats.userId }).from(schema.chats)
      : Promise.resolve([]),
  ])

  const chatUserMap = new Map<string, string>()
  for (const chat of chatsData) {
    if (chatIds.includes(chat.id)) {
      chatUserMap.set(chat.id, chat.userId)
    }
  }

  const prevUserIds = new Set<string>()
  for (const chat of prevChatsData) {
    if (prevChatIds.includes(chat.id)) {
      prevUserIds.add(chat.userId)
    }
  }

  // Get user info for top users
  const userIds = [...new Set(chatUserMap.values())]
  const usersData = userIds.length > 0
    ? await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        image: schema.user.image,
      })
      .from(schema.user)
    : []

  const userInfoMap = new Map<string, { name: string, email: string, image: string | null }>()
  for (const user of usersData) {
    if (userIds.includes(user.id)) {
      userInfoMap.set(user.id, { name: user.name, email: user.email, image: user.image })
    }
  }

  // Collect available sources and models from unfiltered data (for dropdown options)
  const allSources = new Set<string>(['web'])
  const allModels = new Set<string>()
  for (const msg of messagesWithStats) {
    if (msg.model) allModels.add(msg.model)
  }
  for (const usage of apiUsageDataRaw) {
    allSources.add(usage.source)
    if (usage.model) allModels.add(usage.model)
  }
  const availableSources = Array.from(allSources).sort()
  const availableModels = Array.from(allModels).sort()

  // Apply filters
  const filteredMessages = messagesWithStats.filter((msg) => {
    if (sourcesFilter && !sourcesFilter.includes('web')) return false
    if (modelsFilter && !modelsFilter.includes(msg.model ?? 'unknown')) return false
    return true
  })
  const apiUsageData = apiUsageDataRaw.filter((usage) => {
    if (sourcesFilter && !sourcesFilter.includes(usage.source)) return false
    if (modelsFilter && !modelsFilter.includes(usage.model ?? 'unknown')) return false
    return true
  })

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

  // Daily by source aggregation
  const dailyBySourceMap = new Map<string, Map<string, { messageCount: number, inputTokens: number, outputTokens: number }>>()

  // Hourly distribution (0-23)
  const hourlyBuckets: Array<{ messageCount: number, totalTokens: number }> = Array.from({ length: 24 }, () => ({ messageCount: 0, totalTokens: 0 }))

  bySourceMap.set('web', { requests: 0, inputTokens: 0, outputTokens: 0, totalDurationMs: 0 })

  for (const msg of filteredMessages) {
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

    // Daily by source
    if (!dailyBySourceMap.has(dateStr)) dailyBySourceMap.set(dateStr, new Map())
    const daySourceMap = dailyBySourceMap.get(dateStr)!
    const daySourceStats = daySourceMap.get('web') ?? { messageCount: 0, inputTokens: 0, outputTokens: 0 }
    daySourceStats.messageCount++
    daySourceStats.inputTokens += msg.inputTokens ?? 0
    daySourceStats.outputTokens += msg.outputTokens ?? 0
    daySourceMap.set('web', daySourceStats)

    // Hourly distribution
    const hour = msg.createdAt.getUTCHours()
    hourlyBuckets[hour]!.messageCount++
    hourlyBuckets[hour]!.totalTokens += (msg.inputTokens ?? 0) + (msg.outputTokens ?? 0)

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

    // Also add to dailyMap so the chart includes API usage
    const dateStr = usage.createdAt.toISOString().split('T')[0]!
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
    dayModelStats.inputTokens += usage.inputTokens ?? 0
    dayModelStats.outputTokens += usage.outputTokens ?? 0
    dayModelStats.totalDurationMs += usage.durationMs ?? 0
    dayModelMap.set(modelKey, dayModelStats)

    // Daily by source for API usage
    if (!dailyBySourceMap.has(dateStr)) dailyBySourceMap.set(dateStr, new Map())
    const daySourceMap2 = dailyBySourceMap.get(dateStr)!
    const daySourceStats2 = daySourceMap2.get(source) ?? { messageCount: 0, inputTokens: 0, outputTokens: 0 }
    daySourceStats2.messageCount++
    daySourceStats2.inputTokens += usage.inputTokens ?? 0
    daySourceStats2.outputTokens += usage.outputTokens ?? 0
    daySourceMap2.set(source, daySourceStats2)

    // Hourly distribution for API usage
    const hour = usage.createdAt.getUTCHours()
    hourlyBuckets[hour]!.messageCount++
    hourlyBuckets[hour]!.totalTokens += (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
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
        image: userInfo?.image ?? '',
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

  // Generate all dates in the period for zero-filling
  const allDates: string[] = []
  const cursor = new Date(startDate)
  cursor.setHours(0, 0, 0, 0)
  const endDay = new Date(endDate)
  endDay.setHours(0, 0, 0, 0)
  while (cursor <= endDay) {
    allDates.push(cursor.toISOString().split('T')[0]!)
    cursor.setDate(cursor.getDate() + 1)
  }

  // Zero-fill the per-model daily array
  const dailyDates = new Set(daily.map(d => d.date))
  for (const date of allDates) {
    if (!dailyDates.has(date)) {
      daily.push({ date, model: '', messageCount: 0, inputTokens: 0, outputTokens: 0, avgDurationMs: 0 })
    }
  }
  daily.sort((a, b) => a.date.localeCompare(b.date))

  // Daily totals for message trend chart
  const dailyTotalsMap = new Map<string, { messages: number, tokens: number }>()
  for (const [date, modelMap] of dailyMap.entries()) {
    let messages = 0
    let tokens = 0
    for (const stats of modelMap.values()) {
      messages += stats.messageCount
      tokens += stats.inputTokens + stats.outputTokens
    }
    dailyTotalsMap.set(date, { messages, tokens })
  }

  // Zero-fill dailyTotals for all dates in the period
  const dailyTotals = allDates.map(date => {
    const existing = dailyTotalsMap.get(date)
    return { date, messages: existing?.messages ?? 0, tokens: existing?.tokens ?? 0 }
  })

  // Flatten dailyBySource with zero-fill
  const dailyBySource: Array<{ date: string, source: string, messageCount: number, inputTokens: number, outputTokens: number }> = []
  const allSourcesInData = new Set<string>()
  for (const sourceMap of dailyBySourceMap.values()) {
    for (const src of sourceMap.keys()) allSourcesInData.add(src)
  }
  for (const date of allDates) {
    const sourceMap = dailyBySourceMap.get(date)
    for (const src of allSourcesInData) {
      const s = sourceMap?.get(src)
      dailyBySource.push({
        date,
        source: src,
        messageCount: s?.messageCount ?? 0,
        inputTokens: s?.inputTokens ?? 0,
        outputTokens: s?.outputTokens ?? 0,
      })
    }
  }

  // Hourly distribution
  const hourlyDistribution = hourlyBuckets.map((bucket, hour) => ({
    hour,
    messageCount: bucket.messageCount,
    totalTokens: bucket.totalTokens,
  }))

  // Estimated cost from byModel using dynamic gateway pricing
  const pricingMap = await getModelPricingMap()
  const estimatedCost = computeEstimatedCost(byModel, pricingMap)

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
    dailyBySource,
    hourlyDistribution,
    estimatedCost,
    availableSources,
    availableModels,
  }
})
