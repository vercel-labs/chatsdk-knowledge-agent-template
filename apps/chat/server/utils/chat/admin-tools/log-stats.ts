import type { UIToolInvocation } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { db } from '@nuxthub/db'
import { sql } from 'drizzle-orm'

export type LogStatsUIToolInvocation = UIToolInvocation<typeof logStatsTool>

export const logStatsTool = tool({
  description: `Get aggregated log statistics for a dashboard-style overview of application health.
Returns total requests, error rate, status distribution, latency percentiles, top slowest/busiest endpoints, and error paths.`,
  inputSchema: z.object({
    hours: z.number().min(1).max(168).default(24).describe('Number of hours to look back'),
  }),
  execute: async ({ hours }) => {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    const where = `timestamp >= '${cutoff}'`

    try {
      const [overview, statusDist, levelDist, slowest, busiest, errorPaths, latencyRows] = await Promise.all([
        db.run(sql.raw(`SELECT COUNT(*) as total, SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) as errors, AVG(duration_ms) as avg_duration FROM evlog_events WHERE ${where}`)),
        db.run(sql.raw(`SELECT CASE WHEN status >= 500 THEN '5xx' WHEN status >= 400 THEN '4xx' WHEN status >= 300 THEN '3xx' WHEN status >= 200 THEN '2xx' ELSE 'other' END as bucket, COUNT(*) as count FROM evlog_events WHERE ${where} AND status IS NOT NULL GROUP BY bucket ORDER BY bucket`)),
        db.run(sql.raw(`SELECT level, COUNT(*) as count FROM evlog_events WHERE ${where} GROUP BY level ORDER BY count DESC`)),
        db.run(sql.raw(`SELECT method, path, AVG(duration_ms) as avg_ms, MAX(duration_ms) as max_ms, COUNT(*) as count FROM evlog_events WHERE ${where} AND duration_ms IS NOT NULL GROUP BY method, path ORDER BY avg_ms DESC LIMIT 10`)),
        db.run(sql.raw(`SELECT method, path, COUNT(*) as count FROM evlog_events WHERE ${where} GROUP BY method, path ORDER BY count DESC LIMIT 10`)),
        db.run(sql.raw(`SELECT method, path, COUNT(*) as count FROM evlog_events WHERE ${where} AND status >= 500 GROUP BY method, path ORDER BY count DESC LIMIT 10`)),
        db.run(sql.raw(`SELECT duration_ms FROM evlog_events WHERE ${where} AND duration_ms IS NOT NULL ORDER BY duration_ms`)),
      ])

      const total = (overview.rows[0] as any)?.total ?? 0
      const errors = (overview.rows[0] as any)?.errors ?? 0
      const avgDuration = Math.round((overview.rows[0] as any)?.avg_duration ?? 0)

      const durations = (latencyRows.rows ?? []).map((r: any) => r.duration_ms as number)
      const percentile = (arr: number[], p: number) => {
        if (arr.length === 0) return 0
        const idx = Math.ceil((p / 100) * arr.length) - 1
        return arr[Math.max(0, idx)]
      }

      return {
        period: `Last ${hours}h`,
        totalRequests: total,
        errorCount: errors,
        errorRate: total > 0 ? `${((errors / total) * 100).toFixed(1)}%` : '0%',
        statusDistribution: (statusDist.rows ?? []).map((r: any) => ({ bucket: r.bucket, count: r.count })),
        latency: {
          avgMs: avgDuration,
          p50Ms: percentile(durations, 50),
          p95Ms: percentile(durations, 95),
          p99Ms: percentile(durations, 99),
        },
        levelBreakdown: (levelDist.rows ?? []).map((r: any) => ({ level: r.level, count: r.count })),
        top10Slowest: (slowest.rows ?? []).map((r: any) => ({ method: r.method, path: r.path, avgMs: Math.round(r.avg_ms), maxMs: r.max_ms, count: r.count })),
        top10Busiest: (busiest.rows ?? []).map((r: any) => ({ method: r.method, path: r.path, count: r.count })),
        top10ErrorPaths: (errorPaths.rows ?? []).map((r: any) => ({ method: r.method, path: r.path, count: r.count })),
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Query failed' }
    }
  },
})
