import type { UIToolInvocation } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { and, gte, eq, or, like, isNotNull, count, max, sql, desc } from 'drizzle-orm'

export type QueryErrorsUIToolInvocation = UIToolInvocation<typeof queryErrorsTool>

const e = schema.evlogEvents

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

    const conditions = [
      gte(e.timestamp, cutoff),
      or(gte(e.status, 500), eq(e.level, 'error'))!,
    ]
    if (path) conditions.push(like(e.path, path))
    const where = and(...conditions)

    const hourExpr = sql<string>`left(${e.timestamp}, 13)`

    try {
      const [recentErrors, groups, trend] = await Promise.all([
        db.select({
          timestamp: e.timestamp,
          method: e.method,
          path: e.path,
          status: e.status,
          durationMs: e.durationMs,
          error: e.error,
          data: e.data,
          requestId: e.requestId,
        }).from(e).where(where).orderBy(desc(e.timestamp)).limit(20),

        groupBy === 'path'
          ? db.select({
            method: e.method,
            path: e.path,
            count: count(),
            lastSeen: max(e.timestamp),
          }).from(e).where(where).groupBy(e.method, e.path).orderBy(desc(sql`count(*)`)).limit(20)
          : db.select({
            error: e.error,
            count: count(),
            lastSeen: max(e.timestamp),
          }).from(e).where(and(where, isNotNull(e.error))).groupBy(e.error).orderBy(desc(sql`count(*)`)).limit(20),

        db.select({
          hour: hourExpr,
          count: count(),
        }).from(e).where(where).groupBy(hourExpr).orderBy(hourExpr),
      ])

      return {
        period: `Last ${hours}h`,
        recentErrors: recentErrors.map(r => ({
          ...r,
          error: r.error ? truncate(String(r.error), 300) : null,
          data: r.data ? truncate(String(r.data), 200) : null,
        })),
        errorGroups: groups.map((r: any) => groupBy === 'path'
          ? { method: r.method, path: r.path, count: Number(r.count), lastSeen: r.lastSeen }
          : { error: truncate(String(r.error), 200), count: Number(r.count), lastSeen: r.lastSeen },
        ),
        errorTrend: trend.map(r => ({ hour: r.hour, count: Number(r.count) })),
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Query failed' }
    }
  },
})

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}...` : str
}
