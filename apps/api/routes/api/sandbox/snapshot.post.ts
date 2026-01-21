import { start } from 'workflow/api'
import { defineHandler } from 'nitro/h3'
import { useRuntimeConfig } from 'nitro/runtime-config'
import { createSnapshot } from '~/workflows/create-snapshot'

/**
 * POST /api/sandbox/snapshot
 * Create a new sandbox snapshot from the documentation repository.
 *
 * This workflow:
 * 1. Creates a sandbox from the GitHub snapshot repo
 * 2. Takes a snapshot for instant startup
 * 3. Stores the snapshot ID in KV storage
 */
export default defineHandler(async (event) => {
  const config = useRuntimeConfig()
  const { log } = event.context

  const snapshotConfig = {
    githubToken: config.githubToken, // For private repos
    snapshotRepo: config.snapshotRepo,
    snapshotBranch: config.snapshotBranch,
  }

  log.set({ snapshotRepo: config.snapshotRepo })

  await start(createSnapshot, [snapshotConfig])

  return {
    status: 'started',
    message: 'Snapshot workflow started. Use `pnpm workflow:web` to monitor.',
  }
})
