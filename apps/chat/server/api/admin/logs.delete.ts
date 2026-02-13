import { db } from '@nuxthub/db'
import { sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const { before } = await readBody<{ before: string }>(event)
  if (!before) {
    throw createError({ statusCode: 400, message: 'Missing "before" field (ISO date)' })
  }

  const result = await db.run(sql.raw(`DELETE FROM evlog_events WHERE timestamp < '${before}'`))

  return {
    deletedCount: result.rowsAffected ?? 0,
  }
})
