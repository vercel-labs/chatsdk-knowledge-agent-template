import { createSavoir } from '@savoir/sdk'

/**
 * POST /api/admin/sync
 * Trigger documentation sync workflow
 */
export default defineEventHandler(async () => {
  const { savoir: savoirConfig } = useRuntimeConfig()

  const savoir = createSavoir({
    apiUrl: savoirConfig.apiUrl,
    apiKey: savoirConfig.apiKey || undefined,
  })

  return await savoir.client.sync()
})
