import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { defineHandler, getValidatedRouterParams, readValidatedBody, HTTPError } from 'nitro/h3'
import { resolve } from 'pathe'
import { z } from 'zod'
import {
  getSourceById,
  syncGitHubSource,
  pushToSnapshot,
  type GitHubSource,
} from '~/workflows/sync-docs'
import { useRuntimeConfig } from 'nitro/runtime-config'

const paramsSchema = z.object({
  source: z.string().min(1, 'Source ID is required'),
})

const bodySchema = z.object({
  reset: z.boolean().default(false),
  push: z.boolean().default(true),
}).optional()

/**
 * POST /api/sync/:source
 * Triggers sync for a specific source
 *
 * Params:
 * - source: Source ID to sync
 *
 * Body (optional):
 * - reset: boolean - Clear source content before sync (default: false)
 * - push: boolean - Push to snapshot repo after sync (default: true)
 */
export default defineHandler(async (event) => {
  const config = useRuntimeConfig()

  const { source: sourceId } = await getValidatedRouterParams(event, paramsSchema.parse)

  // Validate required environment variables
  if (!config.githubToken) {
    throw HTTPError.status(500, 'GITHUB_TOKEN is not configured')
  }

  if (!config.snapshotRepo) {
    throw HTTPError.status(500, 'GITHUB_SNAPSHOT_REPO is not configured')
  }

  // Find the source
  const source = getSourceById(sourceId)

  if (!source) {
    throw HTTPError.status(404, `Source not found: ${sourceId}`)
  }

  if (source.type !== 'github') {
    throw HTTPError.status(400, `Source type '${source.type}' is not supported yet`)
  }

  const body = await readValidatedBody(event, bodySchema.parse)
  const shouldReset = body?.reset ?? false
  const shouldPush = body?.push ?? true

  // Use a temporary directory for sync
  const syncDir = resolve(tmpdir(), 'savoir-sync', Date.now().toString())
  await mkdir(syncDir, { recursive: true })

  try {
    // Reset if requested
    if (shouldReset) {
      const outputPath = (source as GitHubSource).outputPath || source.id
      await rm(resolve(syncDir, 'docs', outputPath), { recursive: true, force: true })
    }

    const log = event.context.log
    const result = await syncGitHubSource(source as GitHubSource, syncDir)

    // Push to snapshot repository if enabled
    let pushResult = null
    if (shouldPush && result.success) {
      pushResult = await pushToSnapshot(syncDir, {
        repo: config.snapshotRepo,
        branch: config.snapshotBranch || 'main',
        token: config.githubToken,
        message: `chore: sync ${source.label} (${result.fileCount} files)`,
      })
    }

    log.set({
      source: {
        id: source.id,
        label: source.label,
        type: source.type,
      },
      sync: {
        success: result.success,
        fileCount: result.fileCount,
        syncDurationMs: result.duration,
        error: result.error,
      },
      push: pushResult ? {
        success: pushResult.success,
        filesChanged: pushResult.filesChanged,
        commitSha: pushResult.commitSha,
        error: pushResult.error,
      } : null,
    })

    // Cleanup temp directory
    await rm(syncDir, { recursive: true, force: true }).catch(() => {})

    return {
      success: result.success,
      source: {
        id: source.id,
        label: source.label,
      },
      sync: {
        fileCount: result.fileCount,
        duration: result.duration,
        error: result.error,
      },
      push: pushResult
        ? {
          success: pushResult.success,
          commitSha: pushResult.commitSha,
          filesChanged: pushResult.filesChanged,
          error: pushResult.error,
        }
        : null,
    }
  } catch (error) {
    // Cleanup on error
    await rm(syncDir, { recursive: true, force: true }).catch(() => {})

    throw HTTPError.status(500, 'Sync failed')
  }
})
