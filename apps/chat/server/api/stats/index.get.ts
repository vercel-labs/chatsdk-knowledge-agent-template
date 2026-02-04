import { db, schema } from '@nuxthub/db'
import { desc, and, gte, eq } from 'drizzle-orm'

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

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const messagesWithStats = await db
    .select({
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
        gte(schema.messages.createdAt, startDate)
      )
    )
    .orderBy(desc(schema.messages.createdAt))

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
    const modelStats = byModelMap.get(modelKey) ?? { messageCount: 0, inputTokens: 0, outputTokens: 0, positive: 0, negative: 0 }
    modelStats.messageCount++
    modelStats.inputTokens += msg.inputTokens ?? 0
    modelStats.outputTokens += msg.outputTokens ?? 0
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
    const modelStats = byModelMap.get(modelKey) ?? { messageCount: 0, inputTokens: 0, outputTokens: 0, positive: 0, negative: 0 }
    modelStats.messageCount++
    modelStats.inputTokens += usage.inputTokens ?? 0
    modelStats.outputTokens += usage.outputTokens ?? 0
    byModelMap.set(modelKey, modelStats)
  }

  const byModel = Array.from(byModelMap.entries())
    .filter(([model]) => model !== 'unknown')
    .map(([model, stats]) => ({
      model,
      ...stats,
    }))

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

  const daily = Array.from(dailyMap.entries())
    .flatMap(([date, modelMap]) =>
      Array.from(modelMap.entries()).map(([model, stats]) => ({
        date,
        model,
        messageCount: stats.messageCount,
        inputTokens: stats.inputTokens,
        outputTokens: stats.outputTokens,
        avgDurationMs: stats.messageCount > 0 ? Math.round(stats.totalDurationMs / stats.messageCount) : 0,
      }))
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  const totalFeedback = positiveFeedback + negativeFeedback
  const feedbackScore = totalFeedback > 0 ? Math.round((positiveFeedback / totalFeedback) * 100) : null

  return {
    period: {
      days,
      from: startDate.toISOString().split('T')[0]!,
      to: new Date().toISOString().split('T')[0]!,
    },
    totals: {
      messages: totalMessages,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      avgDurationMs: messagesWithDuration > 0 ? Math.round(totalDurationMs / messagesWithDuration) : 0,
    },
    feedback: {
      positive: positiveFeedback,
      negative: negativeFeedback,
      total: totalFeedback,
      score: feedbackScore,
    },
    byModel,
    bySource,
    daily,
  }
})
