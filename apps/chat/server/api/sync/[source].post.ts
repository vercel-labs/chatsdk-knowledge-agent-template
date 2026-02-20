import { start } from 'workflow/api'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'
import { syncDocumentation } from '../../workflows/sync-docs'
import type { Source } from '../../workflows/sync-docs'
import { resolveSnapshotGitHubToken } from '../../utils/github'
import { getSnapshotRepoConfig } from '../../utils/sandbox/snapshot-config'

const paramsSchema = z.object({
  source: z.string().min(1),
})

/**
 * POST /api/sync/:source
 * Sync a specific source using Vercel Sandbox (admin only).
 */
export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  await requireAdmin(event)
  const { source: sourceId } = await getValidatedRouterParams(event, paramsSchema.parse)
  requestLog.set({ sourceId })
  const config = useRuntimeConfig()
  const snapshotConfig = await getSnapshotRepoConfig()

  const dbSource = await db.query.sources.findFirst({
    where: eq(schema.sources.id, sourceId),
  })

  if (!dbSource) {
    throw createError({
      statusCode: 404,
      message: `Source not found: ${sourceId}`,
      data: { why: 'No source exists with this ID in the database', fix: 'Verify the source ID from the sources list' },
    })
  }

  let source: Source
  if (dbSource.type === 'github') {
    source = {
      id: dbSource.id,
      type: 'github',
      label: dbSource.label,
      basePath: dbSource.basePath || '/docs',
      repo: dbSource.repo || '',
      branch: dbSource.branch || 'main',
      contentPath: dbSource.contentPath || '',
      outputPath: dbSource.outputPath || dbSource.id,
      readmeOnly: dbSource.readmeOnly ?? false,
    }
  } else {
    // YouTube source
    source = {
      id: dbSource.id,
      type: 'youtube',
      label: dbSource.label,
      basePath: dbSource.basePath || '/docs',
      channelId: dbSource.channelId || '',
      handle: dbSource.handle || '',
      maxVideos: dbSource.maxVideos || 50,
      outputPath: dbSource.outputPath || dbSource.id,
    }
  }

  const syncConfig = {
    githubToken: await resolveSnapshotGitHubToken({
      explicitToken: config.github.token,
      snapshotRepo: snapshotConfig.snapshotRepo,
      appId: config.github.appId,
      appPrivateKey: config.github.appPrivateKey,
    }),
    youtubeApiKey: config.youtube?.apiKey,
    snapshotRepo: snapshotConfig.snapshotRepo,
    snapshotBranch: snapshotConfig.snapshotBranch,
  }

  await start(syncDocumentation, [syncConfig, [source]])

  requestLog.set({ type: source.type, label: source.label })

  return {
    status: 'started',
    message: `Sync workflow started for "${source.label}".`,
    source: source.id,
  }
})
