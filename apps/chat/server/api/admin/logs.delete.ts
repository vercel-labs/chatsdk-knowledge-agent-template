import { db, schema } from '@nuxthub/db'
import { lt } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const { before } = await readBody<{ before: string }>(event)
  if (!before) {
    throw createError({ statusCode: 400, message: 'Missing "before" field (ISO date)' })
  }

  const result = await db.delete(schema.evlogEvents).where(lt(schema.evlogEvents.timestamp, before))

  return {
    deletedCount: result.rows.length ?? 0,
  }
})
