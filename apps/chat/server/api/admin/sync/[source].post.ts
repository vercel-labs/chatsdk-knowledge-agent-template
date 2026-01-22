import { createSavoir } from '@savoir/sdk'

/**
 * POST /api/admin/sync/:source
 * Trigger sync workflow for a specific source
 */
export default defineEventHandler(async (event) => {
  const source = getRouterParam(event, 'source')
  if (!source) {
    throw createError({ statusCode: 400, statusMessage: 'Source ID is required' })
  }

  const { savoir: savoirConfig } = useRuntimeConfig()

  const savoir = createSavoir({
    apiUrl: savoirConfig.apiUrl,
    apiKey: savoirConfig.apiKey || undefined,
  })

  return await savoir.client.syncSource(source)
})
