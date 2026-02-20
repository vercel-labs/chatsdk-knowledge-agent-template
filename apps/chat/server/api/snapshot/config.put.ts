import { kv } from '@nuxthub/kv'
import { z } from 'zod'
import { getSnapshotRepoConfig, setSnapshotRepoConfig } from '../../utils/sandbox/snapshot-config'
import { KV_KEYS } from '../../utils/sandbox/types'
import { requireAdmin } from '../../utils/admin'
import { ensureRepositoryAndBranch } from '../../utils/github'

const bodySchema = z.object({
  snapshotRepo: z.string().min(1),
  snapshotBranch: z.string().optional(),
  allowExistingRepo: z.boolean().optional(),
})

/**
 * PUT /api/snapshot/config
 * Updates snapshot repository settings (admin only).
 */
export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  await requireAdmin(event)
  const body = await readValidatedBody(event, data => bodySchema.parse(data))
  const config = useRuntimeConfig()

  const snapshotRepo = body.snapshotRepo.trim()
  const snapshotBranch = body.snapshotBranch?.trim() || 'main'

  const ensuredRepo = await ensureRepositoryAndBranch({
    repoPath: snapshotRepo,
    branch: snapshotBranch,
    allowExisting: body.allowExistingRepo === true,
    explicitToken: config.github.token || undefined,
    appId: config.github.appId || undefined,
    appPrivateKey: config.github.appPrivateKey || undefined,
  })

  const previous = await getSnapshotRepoConfig()
  const next = await setSnapshotRepoConfig({
    snapshotRepo,
    snapshotBranch,
  })

  const changed = previous.snapshotRepo !== next.snapshotRepo || previous.snapshotBranch !== next.snapshotBranch

  if (changed) {
    await Promise.all([
      kv.del(KV_KEYS.CURRENT_SNAPSHOT),
      kv.del(KV_KEYS.SNAPSHOT_STATUS_CACHE),
      kv.del(KV_KEYS.ACTIVE_SANDBOX_SESSION),
    ])
  }

  requestLog.set({
    snapshotRepo: next.snapshotRepo,
    snapshotBranch: next.snapshotBranch,
    repositoryEnsured: ensuredRepo.repository.fullName,
    repositoryCreated: ensuredRepo.created,
    repositoryAdoptedExisting: ensuredRepo.adoptedExisting,
    changed,
  })

  return {
    success: true,
    ...next,
    repositoryEnsured: ensuredRepo.repository.fullName,
    repositoryUrl: ensuredRepo.repository.htmlUrl,
    repositoryCreated: ensuredRepo.created,
    repositoryAdoptedExisting: ensuredRepo.adoptedExisting,
    changed,
  }
})
