import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  label: z.string().min(1).optional(),
  // Common output field
  basePath: z.string().optional(),
  // GitHub fields
  repo: z.string().optional(),
  branch: z.string().optional(),
  contentPath: z.string().optional(),
  outputPath: z.string().optional(),
  readmeOnly: z.boolean().optional(),
  // YouTube fields
  channelId: z.string().optional(),
  handle: z.string().optional(),
  maxVideos: z.number().optional(),
})

/**
 * PUT /api/sources/:id
 * Update an existing source
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing source id' })
  }

  const body = await readValidatedBody(event, bodySchema.parse)

  const [source] = await db.update(schema.sources)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(schema.sources.id, id))
    .returning()

  if (!source) {
    throw createError({ statusCode: 404, message: 'Source not found' })
  }

  return source
})
