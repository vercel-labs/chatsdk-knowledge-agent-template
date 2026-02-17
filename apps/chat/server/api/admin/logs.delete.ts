import { db, schema } from '@nuxthub/db'
import { lt, count } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const { before } = await readBody<{ before: string }>(event)
  if (!before) {
    throw createError({ statusCode: 400, message: 'Missing "before" field (ISO date)' })
  }

  const [countResult] = await db.select({ count: count() }).from(schema.evlogEvents).where(lt(schema.evlogEvents.timestamp, before))
  const deletedCount = Number(countResult?.count ?? 0)

  await db.delete(schema.evlogEvents).where(lt(schema.evlogEvents.timestamp, before))

  return { deletedCount }
})
