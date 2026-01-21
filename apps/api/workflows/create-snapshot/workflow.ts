import { Sandbox } from '@vercel/sandbox'
import { kv } from '@vercel/kv'
import { getLogger } from '@savoir/logger'
import { FatalError } from 'workflow'
import type { SnapshotMetadata } from '../../lib/sandbox/types.js'

interface SnapshotConfig {
  // GitHub auth for private repos
  githubToken?: string
  // Snapshot repo config
  snapshotRepo: string
  snapshotBranch: string
}

interface SnapshotWorkflowResult {
  success: boolean
  snapshotId?: string
  error?: string
}

/**
 * Step: Create sandbox from GitHub repository
 */
async function createSandboxStep(config: SnapshotConfig): Promise<Sandbox> {
  'use step'

  const logger = getLogger()
  const repoUrl = `https://github.com/${config.snapshotRepo}.git`

  logger.log('snapshot', `Creating sandbox from: ${repoUrl}#${config.snapshotBranch}`)

  // Build git source with optional GitHub auth for private repos
  const source: {
    type: 'git'
    url: string
    revision: string
    username?: string
    password?: string
  } = {
    type: 'git',
    url: repoUrl,
    revision: config.snapshotBranch,
  }

  // Add GitHub credentials for private repos
  if (config.githubToken) {
    source.username = 'x-access-token'
    source.password = config.githubToken
  }

  const sandbox = await Sandbox.create({
    source,
    timeout: 2 * 60 * 1000, // 2 minutes
    runtime: 'node24',
  })

  logger.log('snapshot', `Sandbox created: ${sandbox.sandboxId}`)
  return sandbox
}

/**
 * Step: Take a snapshot of the sandbox
 */
async function takeSnapshotStep(sandbox: Sandbox): Promise<string> {
  'use step'

  const logger = getLogger()
  logger.log('snapshot', 'Taking snapshot...')

  // This also stops the sandbox automatically
  const snapshot = await sandbox.snapshot()

  logger.log('snapshot', `Snapshot created: ${snapshot.snapshotId}`)
  return snapshot.snapshotId
}

/**
 * Step: Store snapshot metadata in KV
 */
async function storeSnapshotMetadataStep(
  snapshotId: string,
  sourceRepo: string,
): Promise<void> {
  'use step'

  const logger = getLogger()
  logger.log('snapshot', 'Storing snapshot metadata in KV...')

  const metadata: SnapshotMetadata = {
    snapshotId,
    createdAt: Date.now(),
    sourceRepo,
  }

  await kv.set('snapshot:current', metadata)

  logger.log('snapshot', 'Snapshot metadata stored successfully')
}

/**
 * Workflow: Create a new snapshot from the documentation repository
 * Uses Vercel OIDC token automatically.
 * Supports private repos via GitHub token authentication.
 */
export async function createSnapshot(
  config: SnapshotConfig,
): Promise<SnapshotWorkflowResult> {
  'use workflow'

  const logger = getLogger()

  // Validate required configuration
  if (!config.snapshotRepo) {
    throw new FatalError('GITHUB_SNAPSHOT_REPO is not configured')
  }

  try {
    // Step 1: Create sandbox from repository
    const sandbox = await createSandboxStep(config)

    // Step 2: Take snapshot (this also stops the sandbox)
    const snapshotId = await takeSnapshotStep(sandbox)

    // Step 3: Store snapshot metadata
    await storeSnapshotMetadataStep(snapshotId, config.snapshotRepo)

    logger.log('snapshot', `✓ Snapshot workflow completed: ${snapshotId}`)

    return {
      success: true,
      snapshotId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.log('snapshot', `✗ Snapshot workflow failed: ${errorMessage}`)

    return {
      success: false,
      error: errorMessage,
    }
  }
}
