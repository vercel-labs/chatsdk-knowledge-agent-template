import { getLogger } from '@savoir/logger'
import type { GitHubSource, SyncResult } from '../utils/index.js'
import { syncGitHubSource } from '../utils/index.js'

function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`
}

export async function syncSingleSource(
  source: GitHubSource,
  syncDir: string
): Promise<SyncResult> {
  'use step'

  const logger = getLogger()
  logger.log('sync', `Syncing ${source.id}...`)

  const result = await syncGitHubSource(source, syncDir)

  if (result.success) {
    logger.log('sync', `${source.id}: ${result.fileCount} files in ${formatDuration(result.duration)}`)
  } else {
    logger.error({ source: source.id, error: result.error, message: 'Sync failed' })
    throw new Error(`Failed to sync ${source.id}: ${result.error}`)
  }

  return result
}
