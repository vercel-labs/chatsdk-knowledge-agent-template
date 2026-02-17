import { db, schema } from '@nuxthub/db'
import { count, min } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const [total, oldest] = await Promise.all([
    db.select({ count: count() }).from(schema.evlogEvents),
    db.select({ oldest: min(schema.evlogEvents.timestamp) }).from(schema.evlogEvents),
  ])

  return {
    totalCount: Number(total[0]?.count ?? 0),
    oldestLog: oldest[0]?.oldest ?? null,
  }
})
