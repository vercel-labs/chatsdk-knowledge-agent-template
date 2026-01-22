import { createSavoir } from '@savoir/sdk'

/**
 * GET /api/admin/sources
 * Get list of configured sources
 */
export default defineEventHandler(async () => {
  const { savoir: savoirConfig } = useRuntimeConfig()

  const savoir = createSavoir({
    apiUrl: savoirConfig.apiUrl,
    apiKey: savoirConfig.apiKey || undefined,
  })

  return await savoir.client.getSources()
})
