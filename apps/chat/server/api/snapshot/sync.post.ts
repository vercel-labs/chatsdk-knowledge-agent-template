import { syncToSnapshot } from '../../utils/sandbox/snapshot-sync'
import { requireAdmin } from '../../utils/admin'

/**
 * POST /api/snapshot/sync
 * Updates KV to use the latest snapshot (admin only)
 *
 * Response: { success: true, snapshotId }
 */
export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  await requireAdmin(event)

  const metadata = await syncToSnapshot()

  requestLog.set({ snapshotId: metadata.snapshotId })

  return {
    success: true,
    snapshotId: metadata.snapshotId,
  }
})
