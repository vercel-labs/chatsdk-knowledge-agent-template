import { getLogger } from '@savoir/logger'
import { start } from 'workflow/api'
import { createSnapshot } from '../../create-snapshot/index.js'

interface SnapshotConfig {
  // GitHub auth for private repos
  githubToken?: string
  // Snapshot repo config
  snapshotRepo: string
  snapshotBranch: string
}

export async function triggerSnapshotStep(config: SnapshotConfig): Promise<void> {
  'use step'

  const logger = getLogger()
  logger.log('sync', 'Triggering snapshot creation...')

  // Start the snapshot workflow asynchronously
  await start(createSnapshot, [config])

  logger.log('sync', 'Snapshot workflow started')
}
