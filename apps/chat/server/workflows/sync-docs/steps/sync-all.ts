/** Performs complete sync workflow: create sandbox, sync sources, push to git, and take snapshot */

import { log } from 'evlog'
import type { GitHubSource, SyncConfig, SyncSourceResult } from '../types'
import { createSandbox, generateAuthRepoUrl } from '../../../utils/sandbox/context'
import { syncSources } from '../../../utils/sandbox/source-sync'
import { pushChanges, generateCommitMessage } from '../../../utils/sandbox/git'

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

  log.info('sync', `Creating sandbox from ${config.snapshotRepo}#${config.snapshotBranch}`)
  const sandbox = await createSandbox(config)
  log.info('sync', `Sandbox created: ${sandbox.sandboxId}`)

  const results = await syncSources(sandbox, sources)

  for (const result of results) {
    if (result.success) {
      log.info('sync', `${result.label}: synced ${result.fileCount} files`)
    } else {
      log.error('sync', `${result.label}: failed - ${result.error}`)
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
    log.info('sync', '✓ Changes pushed to repository')
  }

  const snapshot = await sandbox.snapshot()
  log.info('sync', `Snapshot created: ${snapshot.snapshotId}`)

  return {
    snapshotId: snapshot.snapshotId,
    results,
    totalFiles,
  }
}
