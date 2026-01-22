import { createSavoir } from '@savoir/sdk'
import { db, schema } from '@nuxthub/db'
import { z } from 'zod'

const bodySchema = z.object({
  sourceId: z.string().optional(),
}).optional()

/**
 * POST /api/admin/sync
 * Trigger documentation sync workflow with sources from DB
 */
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, data => bodySchema.parse(data))
  const { savoir: savoirConfig } = useRuntimeConfig()

  // Get sources from DB
  const allSources = await db.query.sources.findMany()

  // Filter to specific source if requested
  const sourcesToSync = body?.sourceId
    ? allSources.filter(s => s.id === body.sourceId)
    : allSources

  const savoir = createSavoir({
    apiUrl: savoirConfig.apiUrl,
    apiKey: savoirConfig.apiKey || undefined,
  })

  // Pass sources to the API
  return await savoir.client.sync({ sources: sourcesToSync })
})
