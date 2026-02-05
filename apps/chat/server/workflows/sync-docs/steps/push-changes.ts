/**
 * Step: Push Changes to Git
 *
 * Commits and pushes synced documentation changes to the repository.
 */

import { getStepMetadata } from 'workflow'
import { log } from 'evlog'
import { Sandbox } from '@vercel/sandbox'
import type { SyncSourceResult } from '../types'
import { pushChanges as gitPushChanges, generateCommitMessage } from '../../../utils/sandbox/git'
import { generateAuthRepoUrl } from '../../../utils/sandbox/context'

export interface PushChangesConfig {
  snapshotRepo: string
  snapshotBranch: string
  githubToken?: string
}

export interface PushChangesResult {
  success: boolean
  hasChanges: boolean
  error?: string
}

export async function stepPushChanges(
  sandboxId: string,
  config: PushChangesConfig,
  results: SyncSourceResult[],
): Promise<PushChangesResult> {
  'use step'

  const { stepId } = getStepMetadata()
  log.info('sync', `[${stepId}] Pushing changes to ${config.snapshotRepo}#${config.snapshotBranch}`)

  // Reconnect to existing sandbox
  const sandbox = await Sandbox.get({ sandboxId })

  const commitMessage = generateCommitMessage(results)
  const repoUrl = generateAuthRepoUrl(config.snapshotRepo, config.githubToken)

  const pushResult = await gitPushChanges(sandbox, {
    branch: config.snapshotBranch,
    repoUrl,
    commitMessage,
  })

  if (pushResult.success && pushResult.hasChanges) {
    log.info('sync', `[${stepId}] Changes pushed to repository`)
  } else if (pushResult.success && !pushResult.hasChanges) {
    log.info('sync', `[${stepId}] No changes to push`)
  } else {
    log.error('sync', `[${stepId}] Push failed: ${pushResult.error}`)
  }

  return pushResult
}

// Allow more retries for git operations
stepPushChanges.maxRetries = 5
