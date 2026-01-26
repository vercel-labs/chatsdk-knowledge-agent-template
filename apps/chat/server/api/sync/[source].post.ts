import { start } from 'workflow/api'
import { z } from 'zod'
import { syncDocumentation } from '../../workflows/sync-docs'
import type { GitHubSource } from '../../workflows/sync-docs'

const paramsSchema = z.object({
  source: z.string().min(1),
})

/**
 * POST /api/sync/:source
 * Sync a specific source using Vercel Sandbox (admin only).
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { source: sourceId } = await getValidatedRouterParams(event, paramsSchema.parse)
  const config = useRuntimeConfig()

  // Load the specific source from DB
  const dbSource = await db.query.sources.findFirst({
    where: (sources, { eq, and }) => and(
      eq(sources.id, sourceId),
      eq(sources.type, 'github'),
    ),
  })

  if (!dbSource) {
    throw createError({
      statusCode: 404,
      message: `GitHub source not found: ${sourceId}`,
    })
  }

  const source: GitHubSource = {
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

  const syncConfig = {
    githubToken: config.github.token,
    snapshotRepo: config.github.snapshotRepo,
    snapshotBranch: config.github.snapshotBranch,
  }

  await start(syncDocumentation, [syncConfig, [source]])

  return {
    status: 'started',
    message: `Sync workflow started for "${source.label}".`,
    source: source.id,
  }
})
