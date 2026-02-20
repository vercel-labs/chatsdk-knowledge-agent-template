/**
 * Create Snapshot Workflow
 *
 * Creates a new Vercel Sandbox snapshot from a git repository.
 * Returns the snapshot ID - API route handles KV storage.
 */

import { FatalError } from 'workflow'
import { log } from 'evlog'
import type { SnapshotConfig, SnapshotResult } from './types'
import { stepCreateAndSnapshot } from './steps'

export async function createSnapshot(config: SnapshotConfig): Promise<SnapshotResult> {
  'use workflow'

  // Validation errors should not retry
  if (!config.snapshotRepo) {
    throw new FatalError('Snapshot repository is not configured')
  }

  // Let the step execute - errors will propagate and trigger retries
  const { snapshotId } = await stepCreateAndSnapshot(config)

  log.info('snapshot', `✓ Workflow completed: ${snapshotId}`)

  return {
    success: true,
    snapshotId,
    sourceRepo: config.snapshotRepo,
  }
}
