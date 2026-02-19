import { db, schema } from '@nuxthub/db'
import { lt, and, eq, count } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = getQuery(event)
  const before = query.before as string | undefined
  const level = query.level as string | undefined

  if (!before) {
    throw createError({ statusCode: 400, message: 'Missing "before" query parameter (ISO date)' })
  }

  const e = schema.evlogEvents
  const conditions = [lt(e.timestamp, before)]
  if (level && ['info', 'warn', 'error', 'debug'].includes(level)) {
    conditions.push(eq(e.level, level as 'info' | 'warn' | 'error' | 'debug'))
  }

  const [result] = await db.select({ count: count() }).from(e).where(and(...conditions))

  return { count: Number(result?.count ?? 0) }
})
