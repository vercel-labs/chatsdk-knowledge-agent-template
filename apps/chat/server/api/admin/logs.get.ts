import { db } from '@nuxthub/db'
import { sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const [total, oldest] = await Promise.all([
    db.run(sql.raw(`SELECT COUNT(*) as count FROM evlog_events`)),
    db.run(sql.raw(`SELECT MIN(timestamp) as oldest FROM evlog_events`)),
  ])

  return {
    totalCount: (total.rows[0] as any)?.count ?? 0,
    oldestLog: (oldest.rows[0] as any)?.oldest ?? null,
  }
})
