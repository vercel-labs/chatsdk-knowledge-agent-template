import { db, schema } from '@nuxthub/db'
import { lt, and, eq, count } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  await requireAdmin(event)

  const body = await readBody<{ before: string, level?: string }>(event)
  if (!body.before) {
    throw createError({ statusCode: 400, message: 'Missing "before" field (ISO date)', data: { why: 'A cutoff date is required to determine which logs to delete', fix: 'Include a "before" field with an ISO date string in the request body' } })
  }

  const e = schema.evlogEvents
  const conditions = [lt(e.timestamp, body.before)]
  if (body.level && ['info', 'warn', 'error', 'debug'].includes(body.level)) {
    conditions.push(eq(e.level, body.level as 'info' | 'warn' | 'error' | 'debug'))
  }
  const where = and(...conditions)

  const [countResult] = await db.select({ count: count() }).from(e).where(where)
  const deletedCount = Number(countResult?.count ?? 0)

  await db.delete(e).where(where)

  requestLog.set({ before: body.before, level: body.level, deletedCount })

  return { deletedCount }
})
