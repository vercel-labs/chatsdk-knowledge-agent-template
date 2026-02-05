import { kv } from '@nuxthub/kv'
import { start } from 'workflow/api'
import { z } from 'zod'
import { db } from '@nuxthub/db'
import { syncDocumentation } from '../../workflows/sync-docs'
import type { Source } from '../../workflows/sync-docs'
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

  const dbSources = await db.query.sources.findMany()

  let sources: Source[] = dbSources.map((s): Source => {
    if (s.type === 'github') {
      return {
        id: s.id,
        type: 'github' as const,
        label: s.label,
        basePath: s.basePath || '/docs',
        repo: s.repo || '',
        branch: s.branch || 'main',
        contentPath: s.contentPath || '',
        outputPath: s.outputPath || s.id,
        readmeOnly: s.readmeOnly ?? false,
      }
    }

    // YouTube source
    return {
      id: s.id,
      type: 'youtube' as const,
      label: s.label,
      basePath: s.basePath || '/docs',
      channelId: s.channelId || '',
      handle: s.handle || '',
      maxVideos: s.maxVideos || 50,
      outputPath: s.outputPath || s.id,
    }
  })

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
      message: 'No sources to sync',
    })
  }

  const syncConfig = {
    githubToken: config.github.token,
    youtubeApiKey: config.youtube?.apiKey,
    snapshotRepo: config.github.snapshotRepo,
    snapshotBranch: config.github.snapshotBranch,
  }

  await start(syncDocumentation, [syncConfig, sources])

  await kv.set(KV_KEYS.LAST_SOURCE_SYNC, Date.now())

  return {
    status: 'started',
    message: `Sync workflow started for ${sources.length} source(s).`,
  }
})
