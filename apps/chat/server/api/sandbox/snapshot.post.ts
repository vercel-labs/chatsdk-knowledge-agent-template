import { start } from 'workflow/api'
import { createSnapshot } from '../../workflows/create-snapshot'
import { resolveSnapshotGitHubToken } from '../../utils/github'
import { getSnapshotRepoConfig } from '../../utils/sandbox/snapshot-config'

export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  const config = useRuntimeConfig()
  const snapshotConfig = await getSnapshotRepoConfig()

  await start(createSnapshot, [
    {
      githubToken: await resolveSnapshotGitHubToken({
        explicitToken: config.github.token,
        snapshotRepo: snapshotConfig.snapshotRepo,
        appId: config.github.appId,
        appPrivateKey: config.github.appPrivateKey,
      }),
      snapshotRepo: snapshotConfig.snapshotRepo,
      snapshotBranch: snapshotConfig.snapshotBranch,
    }
  ])

  requestLog.set({ workflowStatus: 'started' })

  return { status: 'started', message: 'Snapshot workflow started.' }
})
