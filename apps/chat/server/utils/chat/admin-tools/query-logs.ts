import type { UIToolInvocation } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { and, gte, eq, like, sql, desc } from 'drizzle-orm'
import { preview, cmd } from './_preview'

export type QueryLogsUIToolInvocation = UIToolInvocation<typeof queryLogsTool>

const e = schema.evlogEvents

export const queryLogsTool = tool({
  description: `Browse and search recent production logs from evlog_events.
Use this to inspect recent requests, find specific errors, or filter by path/status/method.`,
  inputSchema: z.object({
    level: z.enum(['info', 'warn', 'error', 'debug']).optional().describe('Filter by log level'),
    path: z.string().optional().describe('Filter by request path (supports SQL LIKE patterns, e.g. /api/%)'),
    status: z.number().optional().describe('Filter by HTTP status code'),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional().describe('Filter by HTTP method'),
    search: z.string().optional().describe('Keyword search in error and data fields'),
    hours: z.number().min(1).max(168).default(24).describe('Number of hours to look back'),
    limit: z.number().min(1).max(200).default(50).describe('Maximum number of entries to return'),
  }),
  execute: async function* ({ level, path, status, method, search, hours, limit }) {
    const filters = [level, method, path, status].filter(Boolean)
    const label = filters.length ? `Query logs (${filters.join(', ')})` : 'Query logs'

    yield { status: 'loading' as const, commands: [cmd(label, '')] }
    const start = Date.now()

    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    const conditions = [gte(e.timestamp, cutoff)]
    if (level) conditions.push(eq(e.level, level))
    if (path) conditions.push(like(e.path, path))
    if (status) conditions.push(eq(e.status, status))
    if (method) conditions.push(eq(e.method, method))
    if (search) {
      conditions.push(sql`(${e.error}::text like ${`%${search}%`} or ${e.data}::text like ${`%${search}%`})`)
    }

    try {
      const result = await db.select({
        timestamp: e.timestamp,
        level: e.level,
        method: e.method,
        path: e.path,
        status: e.status,
        durationMs: e.durationMs,
        error: e.error,
        requestId: e.requestId,
      }).from(e).where(and(...conditions)).orderBy(desc(e.timestamp)).limit(limit)

      const entries = result.map(row => ({
        ...row,
        error: row.error ? truncate(String(row.error), 200) : null,
      }))

      yield { status: 'done' as const, commands: [cmd(label, preview(entries.slice(0, 5)))], durationMs: Date.now() - start, entries, count: entries.length, period: `Last ${hours}h` }
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Query failed'
      yield { status: 'done' as const, commands: [cmd(label, '', err, false)], durationMs: Date.now() - start, error: err }
    }
  },
})

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}...` : str
}
