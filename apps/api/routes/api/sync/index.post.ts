import { start } from 'workflow/api'
import { defineHandler, readValidatedBody } from 'nitro/h3'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { z } from 'zod'
import { syncDocumentation } from '~/workflows/sync-docs'

const sourceSchema = z.object({
  id: z.string(),
  type: z.enum(['github', 'youtube']),
  label: z.string(),
  // GitHub fields
  repo: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  contentPath: z.string().nullable().optional(),
  outputPath: z.string().nullable().optional(),
  readmeOnly: z.boolean().nullable().optional(),
  // YouTube fields
  channelId: z.string().nullable().optional(),
  handle: z.string().nullable().optional(),
  maxVideos: z.number().nullable().optional(),
})

const bodySchema = z
  .object({
    sourceFilter: z.string().optional(),
    sources: z.array(sourceSchema).optional(),
  })
  .optional()

/**
 * POST /api/sync
 * Sync all sources using Vercel Sandbox.
 *
 * Body (optional):
 * - sourceFilter: string - Only sync a specific source
 * - sources: array - Sources to sync (passed from chat app DB)
 */
export default defineHandler(async (event) => {
  const body = await readValidatedBody(event, data => bodySchema.parse(data))
  const config = useRuntimeConfig()

  const syncConfig = {
    githubToken: config.githubToken,
    snapshotRepo: config.snapshotRepo,
    snapshotBranch: config.snapshotBranch,
  }

  const options = {
    sourceFilter: body?.sourceFilter,
    sources: body?.sources,
  }

  await start(syncDocumentation, [syncConfig, options])

  return {
    status: 'started',
    message: 'Sync workflow started. Use `pnpm workflow:web` to monitor.',
  }
})
