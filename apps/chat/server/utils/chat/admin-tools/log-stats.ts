import type { UIToolInvocation } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { count, avg, max, sql, gte, and, isNotNull, desc } from 'drizzle-orm'
import { preview, cmd } from './_preview'

export type LogStatsUIToolInvocation = UIToolInvocation<typeof logStatsTool>

const e = schema.evlogEvents

export const logStatsTool = tool({
  description: `Get aggregated log statistics for a dashboard-style overview of application health.
Returns total requests, error rate, status distribution, latency percentiles, top slowest/busiest endpoints, and error paths.`,
  inputSchema: z.object({
    hours: z.number().min(1).max(168).default(24).describe('Number of hours to look back'),
  }),
  execute: async function* ({ hours }) {
    const label = `Log stats (${hours}h)`
    yield { status: 'loading' as const, commands: [cmd(label, '')] }
    const start = Date.now()

    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    const timeFilter = gte(e.timestamp, cutoff)

    const statusBucket = sql<string>`case when ${e.status} >= 500 then '5xx' when ${e.status} >= 400 then '4xx' when ${e.status} >= 300 then '3xx' when ${e.status} >= 200 then '2xx' else 'other' end`

    try {
      const [overview, statusDist, levelDist, slowest, busiest, errorPaths, latencyRows] = await Promise.all([
        db.select({
          total: count(),
          errors: sql<number>`coalesce(sum(case when ${e.status} >= 500 then 1 else 0 end), 0)`,
          avgDuration: avg(e.durationMs),
        }).from(e).where(timeFilter),

        db.select({
          bucket: statusBucket,
          count: count(),
        }).from(e).where(and(timeFilter, isNotNull(e.status))).groupBy(statusBucket).orderBy(statusBucket),

        db.select({
          level: e.level,
          count: count(),
        }).from(e).where(timeFilter).groupBy(e.level).orderBy(desc(sql`count(*)`)),

        db.select({
          method: e.method,
          path: e.path,
          avgMs: sql<number>`round(avg(${e.durationMs}))`,
          maxMs: max(e.durationMs),
          count: count(),
        }).from(e).where(and(timeFilter, isNotNull(e.durationMs))).groupBy(e.method, e.path).orderBy(desc(sql`avg(${e.durationMs})`)).limit(10),

        db.select({
          method: e.method,
          path: e.path,
          count: count(),
        }).from(e).where(timeFilter).groupBy(e.method, e.path).orderBy(desc(sql`count(*)`)).limit(10),

        db.select({
          method: e.method,
          path: e.path,
          count: count(),
        }).from(e).where(and(timeFilter, gte(e.status, 500))).groupBy(e.method, e.path).orderBy(desc(sql`count(*)`)).limit(10),

        db.select({
          durationMs: e.durationMs,
        }).from(e).where(and(timeFilter, isNotNull(e.durationMs))).orderBy(e.durationMs),
      ])

      const total = Number(overview[0]?.total ?? 0)
      const errors = Number(overview[0]?.errors ?? 0)
      const avgDuration = Math.round(Number(overview[0]?.avgDuration ?? 0))

      const durations = latencyRows.map(r => r.durationMs as number)
      const percentile = (arr: number[], p: number) => {
        if (arr.length === 0) return 0
        const idx = Math.ceil((p / 100) * arr.length) - 1
        return arr[Math.max(0, idx)]
      }

      const overviewData = { total, errors, errorRate: total > 0 ? `${((errors / total) * 100).toFixed(1)}%` : '0%', avgMs: avgDuration, statusDistribution: statusDist.map(r => ({ bucket: r.bucket, count: Number(r.count) })) }
      yield {
        status: 'done' as const,
        commands: [cmd(label, preview(overviewData))],
        durationMs: Date.now() - start,
        period: `Last ${hours}h`,
        totalRequests: total,
        errorCount: errors,
        errorRate: total > 0 ? `${((errors / total) * 100).toFixed(1)}%` : '0%',
        statusDistribution: statusDist.map(r => ({ bucket: r.bucket, count: Number(r.count) })),
        latency: {
          avgMs: avgDuration,
          p50Ms: percentile(durations, 50),
          p95Ms: percentile(durations, 95),
          p99Ms: percentile(durations, 99),
        },
        levelBreakdown: levelDist.map(r => ({ level: r.level, count: Number(r.count) })),
        top10Slowest: slowest.map(r => ({ method: r.method, path: r.path, avgMs: Number(r.avgMs), maxMs: Number(r.maxMs), count: Number(r.count) })),
        top10Busiest: busiest.map(r => ({ method: r.method, path: r.path, count: Number(r.count) })),
        top10ErrorPaths: errorPaths.map(r => ({ method: r.method, path: r.path, count: Number(r.count) })),
      }
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Query failed'
      yield { status: 'done' as const, commands: [cmd(label, '', err, false)], durationMs: Date.now() - start, error: err }
    }
  },
})
