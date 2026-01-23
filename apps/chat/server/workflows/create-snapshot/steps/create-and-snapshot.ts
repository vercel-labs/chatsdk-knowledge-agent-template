/** Creates sandbox from repository and takes snapshot */

import { getLogger } from '@savoir/logger'
import type { SnapshotConfig } from '../types'
import { createSandbox } from '../../../lib/sandbox/context'

export interface SnapshotResult {
  snapshotId: string
  sandboxId: string
}

export async function stepCreateAndSnapshot(config: SnapshotConfig): Promise<SnapshotResult> {
  'use step'

  const logger = getLogger()

  logger.log('snapshot', `Creating sandbox from ${config.snapshotRepo}#${config.snapshotBranch}`)
  const sandbox = await createSandbox(config, 2 * 60 * 1000)
  logger.log('snapshot', `Sandbox created: ${sandbox.sandboxId}`)

  const snapshot = await sandbox.snapshot()
  logger.log('snapshot', `✓ Snapshot created: ${snapshot.snapshotId}`)

  return {
    snapshotId: snapshot.snapshotId,
    sandboxId: sandbox.sandboxId,
  }
}
