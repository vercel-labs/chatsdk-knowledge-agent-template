import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const paramsSchema = z.object({
  id: z.string().min(1, 'Missing source ID'),
})

/**
 * DELETE /api/sources/:id
 * Delete a source (admin only)
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const [deleted] = await db.delete(schema.sources)
    .where(eq(schema.sources.id, id))
    .returning()

  if (!deleted) {
    throw createError({ statusCode: 404, message: 'Source not found' })
  }

  return { success: true }
})
