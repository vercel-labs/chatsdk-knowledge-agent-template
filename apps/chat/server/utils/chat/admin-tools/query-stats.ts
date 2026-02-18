import type { UIToolInvocation } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { eq, gte, and, count } from 'drizzle-orm'

export type QueryStatsUIToolInvocation = UIToolInvocation<typeof queryStatsTool>

export const queryStatsTool = tool({
  description: `Query usage statistics for the application. Returns message counts, token usage, model usage, and active users over a given period.
Use this to answer questions about app usage, costs, activity trends, and popular models.`,
  inputSchema: z.object({
    days: z.number().min(1).max(365).default(30).describe('Number of days to look back'),
  }),
  execute: async function* ({ days }) {
    yield { status: 'loading' as const, label: `Query stats (${days}d)` }
    const start = Date.now()

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const [messagesData, chatCount, userCount] = await Promise.all([
      db
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
            gte(schema.messages.createdAt, startDate),
          ),
        ),
      db.select({ count: count() }).from(schema.chats).where(gte(schema.chats.createdAt, startDate)),
      db.select({ count: count() }).from(schema.user),
    ])

    let totalMessages = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalDurationMs = 0
    let positiveFeedback = 0
    let negativeFeedback = 0
    const byModel = new Map<string, { count: number, inputTokens: number, outputTokens: number }>()

    for (const msg of messagesData) {
      totalMessages++
      totalInputTokens += msg.inputTokens ?? 0
      totalOutputTokens += msg.outputTokens ?? 0
      totalDurationMs += msg.durationMs ?? 0
      if (msg.feedback === 'positive') positiveFeedback++
      if (msg.feedback === 'negative') negativeFeedback++

      const model = msg.model ?? 'unknown'
      const existing = byModel.get(model) ?? { count: 0, inputTokens: 0, outputTokens: 0 }
      existing.count++
      existing.inputTokens += msg.inputTokens ?? 0
      existing.outputTokens += msg.outputTokens ?? 0
      byModel.set(model, existing)
    }

    const modelBreakdown = Array.from(byModel.entries())
      .map(([model, stats]) => ({ model, ...stats }))
      .sort((a, b) => b.count - a.count)

    yield {
      status: 'done' as const,
      label: `Query stats (${days}d)`,
      durationMs: Date.now() - start,
      period: `Last ${days} days`,
      totalMessages,
      totalChats: chatCount[0]?.count ?? 0,
      totalUsers: userCount[0]?.count ?? 0,
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      avgDurationMs: totalMessages > 0 ? Math.round(totalDurationMs / totalMessages) : 0,
      feedback: { positive: positiveFeedback, negative: negativeFeedback },
      modelBreakdown,
    }
  },
})
