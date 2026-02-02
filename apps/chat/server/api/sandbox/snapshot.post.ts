import { start } from 'workflow/api'
import { createSnapshot } from '../../workflows/create-snapshot'

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()

  await start(createSnapshot, [
    {
      githubToken: config.github.token,
      snapshotRepo: config.github.snapshotRepo,
      snapshotBranch: config.github.snapshotBranch,
    }
  ])

  return { status: 'started', message: 'Snapshot workflow started.' }
})
