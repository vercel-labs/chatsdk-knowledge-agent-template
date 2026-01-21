import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { defineHandler, readValidatedBody, HTTPError } from 'nitro/h3'
import { resolve } from 'pathe'
import { z } from 'zod'
import {
  getGitHubSources,
  syncGitHubSource,
  pushToSnapshot,
  type SyncResult,
} from '~/workflows/sync-docs'
import { useRuntimeConfig } from 'nitro/runtime-config'

const bodySchema = z.object({
  reset: z.boolean().default(false),
  push: z.boolean().default(true),
}).optional()

/**
 * POST /api/sync
 * Triggers a full content synchronization
 *
 * Body (optional):
 * - reset: boolean - Clear all content before sync (default: false)
 * - push: boolean - Push to snapshot repo after sync (default: true)
 */
export default defineHandler(async (event) => {
  const config = useRuntimeConfig()

  // Validate required environment variables
  if (!config.githubToken) {
    throw HTTPError.status(500, 'GITHUB_TOKEN is not configured')
  }

  if (!config.snapshotRepo) {
    throw HTTPError.status(500, 'GITHUB_SNAPSHOT_REPO is not configured')
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
      await rm(resolve(syncDir, 'docs'), { recursive: true, force: true })
      await mkdir(resolve(syncDir, 'docs'), { recursive: true })
    }

    // Sync all GitHub sources
    const sources = getGitHubSources()
    const results: SyncResult[] = []

    const log = event.context.log

    for (const source of sources) {
      const result = await syncGitHubSource(source, syncDir)
      results.push(result)
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length
    const totalFiles = results.reduce((sum, r) => sum + (r.fileCount || 0), 0)

    // Push to snapshot repository if enabled
    let pushResult = null
    if (shouldPush && successCount > 0) {
      pushResult = await pushToSnapshot(syncDir, {
        repo: config.snapshotRepo,
        branch: config.snapshotBranch || 'main',
        token: config.githubToken,
        message: `chore: sync ${successCount} sources (${totalFiles} files)`,
      })
    }

    log.set({
      sync: {
        sourcesTotal: sources.length,
        sourcesSuccess: successCount,
        sourcesFailed: failCount,
        filesTotal: totalFiles,
      },
      push: pushResult ? {
        success: pushResult.success,
        filesChanged: pushResult.filesChanged,
        commitSha: pushResult.commitSha,
      } : null,
    })

    // Cleanup temp directory
    await rm(syncDir, { recursive: true, force: true }).catch(() => {})

    return {
      success: failCount === 0,
      summary: {
        total: sources.length,
        success: successCount,
        failed: failCount,
        files: totalFiles,
      },
      push: pushResult
        ? {
          success: pushResult.success,
          commitSha: pushResult.commitSha,
          filesChanged: pushResult.filesChanged,
          error: pushResult.error,
        }
        : null,
      results: results.map((r) => ({
        sourceId: r.sourceId,
        success: r.success,
        fileCount: r.fileCount,
        duration: r.duration,
        error: r.error,
      })),
    }
  } catch (error) {
    // Cleanup on error
    await rm(syncDir, { recursive: true, force: true }).catch(() => {})

    throw HTTPError.status(500, 'Sync failed')
  }
})
