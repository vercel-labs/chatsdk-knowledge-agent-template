import { getAgentConfig } from '../../utils/agent-config'

/**
 * GET /api/agent-config/public
 * Get the active agent configuration for SDK (protected by API key via middleware)
 *
 * This endpoint is used by external bots (github-bot, etc.) to fetch
 * the current agent configuration via the SDK.
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  return await getAgentConfig()
})
