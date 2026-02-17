import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing API key ID' })
  }

  await db.delete(schema.apikey).where(eq(schema.apikey.id, id))

  return { deleted: true }
})
