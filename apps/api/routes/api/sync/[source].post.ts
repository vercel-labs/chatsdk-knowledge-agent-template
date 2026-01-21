import { start } from 'workflow/api'
import { defineHandler, readValidatedBody, getValidatedRouterParams } from 'nitro/h3'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { z } from 'zod'
import { syncDocumentation } from '~/workflows/sync-docs'

const paramsSchema = z.object({
  source: z.string().min(1),
})

const bodySchema = z
  .object({
    reset: z.boolean().default(false),
    push: z.boolean().default(true),
  })
  .optional()

/**
 * POST /api/sync/:source
 * Sync a specific source.
 *
 * Params:
 * - source: Source ID to sync
 *
 * Body (optional):
 * - reset: boolean - Clear content before sync (default: false)
 * - push: boolean - Push to snapshot repo after sync (default: true)
 */
export default defineHandler(async (event) => {
  const { source } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, data => bodySchema.parse(data))
  const config = useRuntimeConfig()

  const syncConfig = {
    githubToken: config.githubToken,
    snapshotRepo: config.snapshotRepo,
    snapshotBranch: config.snapshotBranch,
  }

  const options = {
    reset: body?.reset ?? false,
    push: body?.push ?? true,
    sourceFilter: source,
  }

  await start(syncDocumentation, [syncConfig, options])

  return {
    status: 'started',
    message: `Sync workflow started for source "${source}". Use \`pnpm workflow:web\` to monitor.`,
    source,
    options,
  }
})
