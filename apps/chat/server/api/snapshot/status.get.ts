import { getSnapshotSyncStatus } from '../../utils/sandbox/snapshot-sync'
import { requireAdmin } from '../../utils/admin'

/**
 * GET /api/snapshot/status
 * Returns current snapshot sync status (admin only)
 *
 * Response: { currentSnapshotId, latestSnapshotId, needsSync, latestCreatedAt }
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return await getSnapshotSyncStatus()
})
