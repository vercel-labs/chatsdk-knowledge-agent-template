import { rm } from 'node:fs/promises'
import { getLogger } from '@savoir/logger'

export async function cleanupWorkspace(syncDir: string): Promise<void> {
  'use step'

  const logger = getLogger()

  try {
    await rm(syncDir, { recursive: true, force: true })
    logger.log('sync', 'Workspace cleaned up')
  } catch {
    logger.log('sync', 'Failed to cleanup workspace')
  }
}
