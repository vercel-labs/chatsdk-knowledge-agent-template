/** Performs complete sync workflow: create sandbox, sync sources, push to git, and take snapshot */

import { getLogger } from '@savoir/logger'
import type { GitHubSource, SyncConfig, SyncSourceResult } from '../types'
import { createSandbox, generateAuthRepoUrl } from '../../../lib/sandbox/context'
import { syncSources } from '../../../lib/sandbox/source-sync'
import { pushChanges, generateCommitMessage } from '../../../lib/sandbox/git'

export interface SyncAllResult {
  snapshotId: string
  results: SyncSourceResult[]
  totalFiles: number
}

export async function stepSyncAll(
  config: SyncConfig,
  sources: GitHubSource[],
): Promise<SyncAllResult> {
  'use step'

  const logger = getLogger()

  logger.log('sync', `Creating sandbox from ${config.snapshotRepo}#${config.snapshotBranch}`)
  const sandbox = await createSandbox(config)
  logger.log('sync', `Sandbox created: ${sandbox.sandboxId}`)

  const results = await syncSources(sandbox, sources)

  for (const result of results) {
    if (result.success) {
      logger.log('sync', `${result.sourceId}: synced ${result.fileCount} files`)
    } else {
      logger.log('sync', `${result.sourceId}: failed - ${result.error}`)
    }
  }

  const totalFiles = results.reduce((sum: number, r: SyncSourceResult) => sum + (r.fileCount || 0), 0)

  const commitMessage = generateCommitMessage(results)
  const repoUrl = generateAuthRepoUrl(config.snapshotRepo, config.githubToken)

  const pushResult = await pushChanges(sandbox, {
    branch: config.snapshotBranch,
    repoUrl,
    commitMessage,
  })

  if (pushResult.success && pushResult.hasChanges) {
    logger.log('sync', '✓ Changes pushed to repository')
  }

  const snapshot = await sandbox.snapshot()
  logger.log('sync', `Snapshot created: ${snapshot.snapshotId}`)

  return {
    snapshotId: snapshot.snapshotId,
    results,
    totalFiles,
  }
}
