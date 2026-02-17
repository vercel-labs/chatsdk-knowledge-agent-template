import type { UIToolInvocation } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { db } from '@nuxthub/db'
import { sql } from 'drizzle-orm'

export type QueryErrorsUIToolInvocation = UIToolInvocation<typeof queryErrorsTool>

export const queryErrorsTool = tool({
  description: `Error-focused log analysis. Returns recent errors with details, error groups by path or error message, and an error trend (count per hour).
Use this to investigate production errors and identify patterns.`,
  inputSchema: z.object({
    hours: z.number().min(1).max(168).default(24).describe('Number of hours to look back'),
    path: z.string().optional().describe('Filter to a specific path (supports SQL LIKE patterns)'),
    groupBy: z.enum(['path', 'error']).default('path').describe('Group errors by path or error message'),
  }),
  execute: async ({ hours, path, groupBy }) => {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    const conditions: string[] = [`timestamp >= '${cutoff}'`, `(status >= 500 OR level = 'error')`]
    if (path) conditions.push(`path LIKE '${path}'`)
    const where = conditions.join(' AND ')

    try {
      const [recentErrors, groups, trend] = await Promise.all([
        db.run(sql.raw(`SELECT timestamp, method, path, status, duration_ms, error, data, request_id FROM evlog_events WHERE ${where} ORDER BY timestamp DESC LIMIT 20`)),
        groupBy === 'path'
          ? db.run(sql.raw(`SELECT method, path, COUNT(*) as count, MAX(timestamp) as last_seen FROM evlog_events WHERE ${where} GROUP BY method, path ORDER BY count DESC LIMIT 20`))
          : db.run(sql.raw(`SELECT error, COUNT(*) as count, MAX(timestamp) as last_seen FROM evlog_events WHERE ${where} AND error IS NOT NULL GROUP BY error ORDER BY count DESC LIMIT 20`)),
        db.run(sql.raw(`SELECT to_char(timestamp, 'YYYY-MM-DD HH24":00"') as hour, COUNT(*) as count FROM evlog_events WHERE ${where} GROUP BY hour ORDER BY hour`)),
      ])

      return {
        period: `Last ${hours}h`,
        recentErrors: (recentErrors.rows ?? []).map((r: any) => ({
          timestamp: r.timestamp,
          method: r.method,
          path: r.path,
          status: r.status,
          durationMs: r.duration_ms,
          error: r.error ? truncate(String(r.error), 300) : null,
          data: r.data ? truncate(String(r.data), 200) : null,
          requestId: r.request_id,
        })),
        errorGroups: (groups.rows ?? []).map((r: any) => groupBy === 'path'
          ? { method: r.method, path: r.path, count: r.count, lastSeen: r.last_seen }
          : { error: truncate(String(r.error), 200), count: r.count, lastSeen: r.last_seen },
        ),
        errorTrend: (trend.rows ?? []).map((r: any) => ({ hour: r.hour, count: r.count })),
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Query failed' }
    }
  },
})

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max) }...` : str
}
