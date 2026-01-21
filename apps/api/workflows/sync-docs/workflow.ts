import { getLogger } from '@savoir/logger'
import { FatalError } from 'workflow'
import type { SyncResult, SyncConfig, SyncOptions } from './utils/index.js'
import {
  prepareWorkspace,
  getSourcesToSync,
  syncSingleSource,
  pushToSnapshotStep,
  cleanupWorkspace,
} from './steps/index.js'

interface SyncWorkflowResult {
  success: boolean
  summary: {
    total: number
    success: number
    failed: number
    files: number
  }
  push?: { success: boolean; commitSha?: string; error?: string } | null
  results: SyncResult[]
}

/**
 * Workflow: Sync documentation from all configured sources.
 */
export async function syncDocumentation(
  config: SyncConfig,
  options: SyncOptions = {}
): Promise<SyncWorkflowResult> {
  'use workflow'

  const { reset = false, push = true, sourceFilter } = options

  if (!config.githubToken) {
    throw new FatalError('GITHUB_TOKEN is not configured')
  }
  if (!config.snapshotRepo) {
    throw new FatalError('GITHUB_SNAPSHOT_REPO is not configured')
  }

  const syncDir = await prepareWorkspace(reset)
  const sources = await getSourcesToSync(sourceFilter)

  if (sources.length === 0) {
    await cleanupWorkspace(syncDir)
    throw new FatalError('No sources to sync')
  }

  const results: SyncResult[] = []
  for (const source of sources) {
    const result = await syncSingleSource(source, syncDir)
    results.push(result)
  }

  const successCount = results.filter((r) => r.success).length
  const failCount = results.filter((r) => !r.success).length
  const totalFiles = results.reduce((sum, r) => sum + (r.fileCount || 0), 0)

  let pushResult = null
  if (push && successCount > 0) {
    pushResult = await pushToSnapshotStep(syncDir, config, successCount, totalFiles)
  }

  await cleanupWorkspace(syncDir)

  // Log summary
  const logger = getLogger()
  const status = failCount === 0 ? '✓' : '✗'
  logger.log('sync', `${status} Done: ${successCount}/${sources.length} sources, ${totalFiles} files`)

  return {
    success: failCount === 0 && (!push || pushResult?.success !== false),
    summary: {
      total: sources.length,
      success: successCount,
      failed: failCount,
      files: totalFiles,
    },
    push: pushResult,
    results,
  }
}
