import { start } from 'workflow/api'
import { createSnapshot } from '../../workflows/create-snapshot'

export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  const config = useRuntimeConfig()

  await start(createSnapshot, [
    {
      githubToken: config.github.token,
      snapshotRepo: config.github.snapshotRepo,
      snapshotBranch: config.github.snapshotBranch,
    }
  ])

  requestLog.set({ workflowStatus: 'started' })

  return { status: 'started', message: 'Snapshot workflow started.' }
})
