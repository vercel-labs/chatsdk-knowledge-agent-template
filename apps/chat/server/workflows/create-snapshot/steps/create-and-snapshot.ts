/** Creates sandbox from repository and takes snapshot */

import { log } from 'evlog'
import type { SnapshotConfig } from '../types'
import { createSandbox } from '../../../utils/sandbox/context'

export interface SnapshotResult {
  snapshotId: string
  sandboxId: string
}

export async function stepCreateAndSnapshot(config: SnapshotConfig): Promise<SnapshotResult> {
  'use step'

  log.info('snapshot', `Creating sandbox from ${config.snapshotRepo}#${config.snapshotBranch}`)
  const sandbox = await createSandbox(config, 2 * 60 * 1000)
  log.info('snapshot', `Sandbox created: ${sandbox.sandboxId}`)

  const snapshot = await sandbox.snapshot()
  log.info('snapshot', `✓ Snapshot created: ${snapshot.snapshotId}`)

  return {
    snapshotId: snapshot.snapshotId,
    sandboxId: sandbox.sandboxId,
  }
}
