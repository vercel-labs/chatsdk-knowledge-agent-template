import { kv } from '@nuxthub/kv'
import { start } from 'workflow/api'
import { z } from 'zod'
import { syncDocumentation } from '../../workflows/sync-docs'
import type { GitHubSource } from '../../workflows/sync-docs'
import { KV_KEYS } from '../../utils/sandbox/types'

const bodySchema = z
  .object({
    sourceFilter: z.string().optional(),
  })
  .optional()

/**
 * POST /api/sync
 * Sync all sources using Vercel Sandbox (admin only).
 *
 * Body (optional):
 * - sourceFilter: string - Only sync a specific source
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readValidatedBody(event, data => bodySchema.parse(data))
  const config = useRuntimeConfig()

  // Load sources from DB
  const dbSources = await db.query.sources.findMany()

  // Filter to GitHub sources and transform
  let sources: GitHubSource[] = dbSources
    .filter(s => s.type === 'github')
    .map(s => ({
      id: s.id,
      type: 'github' as const,
      label: s.label,
      basePath: s.basePath || '/docs',
      repo: s.repo || '',
      branch: s.branch || 'main',
      contentPath: s.contentPath || '',
      outputPath: s.outputPath || s.id,
      readmeOnly: s.readmeOnly ?? false,
    }))

  // Apply filter if specified
  if (body?.sourceFilter) {
    sources = sources.filter(s => s.id === body.sourceFilter)
    if (sources.length === 0) {
      throw createError({
        statusCode: 404,
        message: `Source not found: ${body.sourceFilter}`,
      })
    }
  }

  if (sources.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No GitHub sources to sync',
    })
  }

  const syncConfig = {
    githubToken: config.github.token,
    snapshotRepo: config.github.snapshotRepo,
    snapshotBranch: config.github.snapshotBranch,
  }

  await start(syncDocumentation, [syncConfig, sources])

  // Track last sync time
  await kv.set(KV_KEYS.LAST_SOURCE_SYNC, Date.now())

  return {
    status: 'started',
    message: `Sync workflow started for ${sources.length} source(s).`,
  }
})
