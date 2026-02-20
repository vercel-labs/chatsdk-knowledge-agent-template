import { getSnapshotRepoConfig } from '../../utils/sandbox/snapshot-config'
import { requireAdmin } from '../../utils/admin'

/**
 * GET /api/snapshot/config
 * Returns the configured snapshot repository (admin only).
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return await getSnapshotRepoConfig()
})
