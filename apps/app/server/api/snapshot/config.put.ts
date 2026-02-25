import { kv } from '@nuxthub/kv'
import { z } from 'zod'
import { createError } from 'evlog'
import { getSnapshotRepoConfig, setSnapshotRepoConfig } from '../../utils/sandbox/snapshot-config'
import { KV_KEYS } from '../../utils/sandbox/types'
import { requireAdmin } from '../../utils/admin'

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

  const token = await getSnapshotToken(snapshotRepo)
  if (!token) {
    throw createError({
      status: 400,
      message: 'GitHub token not found',
      why: 'Could not resolve a GitHub token for this repository',
      fix: 'Ensure your GitHub App is installed on this repository, or set NUXT_GITHUB_TOKEN',
    })
  }

  const ensuredRepo = await ensureSnapshotRepo({
    repoPath: snapshotRepo,
    branch: snapshotBranch,
    allowExisting: body.allowExistingRepo === true,
    token,
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
