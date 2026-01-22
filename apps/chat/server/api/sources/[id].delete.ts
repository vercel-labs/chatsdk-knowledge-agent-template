import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

/**
 * DELETE /api/sources/:id
 * Delete a source
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing source id' })
  }

  const [deleted] = await db.delete(schema.sources)
    .where(eq(schema.sources.id, id))
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, message: 'Source not found' })
  }

  return { success: true }
})
