import { useStorage } from 'nitro/storage'
import { getLogger } from '@savoir/logger'
import { FatalError } from 'workflow'
import type { SnapshotMetadata } from '../../lib/sandbox/types.js'
import { KV_KEYS } from '../../lib/sandbox/types.js'
import type { SyncConfig, SyncOptions, SyncResult } from './utils/index.js'
import {
  getSourcesToSync,
  syncAllSourcesInSandbox,
} from './steps/index.js'

interface SyncWorkflowResult {
  success: boolean
  snapshotId?: string
  summary: {
    total: number
    success: number
    failed: number
    files: number
  }
  results: SyncResult[]
}

/**
 * Workflow: Sync documentation using Vercel Sandbox.
 *
 * All filesystem operations run inside a Vercel Sandbox,
 * making it compatible with serverless environments.
 */
export async function syncDocumentation(
  config: SyncConfig,
  options: SyncOptions = {},
): Promise<SyncWorkflowResult> {
  'use workflow'

  const { sourceFilter, sources: dbSources } = options
  const logger = getLogger()

  if (!config.snapshotRepo) {
    throw new FatalError('GITHUB_SNAPSHOT_REPO is not configured')
  }

  // Step 1: Get sources to sync
  const sources = await getSourcesToSync({ sourceFilter, sources: dbSources })

  if (sources.length === 0) {
    throw new FatalError('No sources to sync')
  }

  logger.log('sync', `Syncing ${sources.length} sources...`)

  // Step 2: Sync all sources in sandbox and get snapshot
  // This is a single step because the Sandbox object is not serializable
  const { snapshotId, results } = await syncAllSourcesInSandbox(
    sources,
    config.snapshotRepo,
    config.snapshotBranch || 'main',
    config.githubToken,
  )

  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length
  const totalFiles = results.reduce((sum, r) => sum + (r.fileCount || 0), 0)

  // Step 3: Store snapshot metadata in KV
  const metadata: SnapshotMetadata = {
    snapshotId,
    createdAt: Date.now(),
    sourceRepo: config.snapshotRepo,
  }

  const kv = useStorage('kv')
  await kv.setItem(KV_KEYS.CURRENT_SNAPSHOT, metadata)
  logger.log('sync', 'Snapshot metadata stored in KV')

  const status = failCount === 0 ? '✓' : '✗'
  logger.log('sync', `${status} Done: ${successCount}/${sources.length} sources, ${totalFiles} files`)

  return {
    success: failCount === 0,
    snapshotId,
    summary: {
      total: sources.length,
      success: successCount,
      failed: failCount,
      files: totalFiles,
    },
    results,
  }
}
