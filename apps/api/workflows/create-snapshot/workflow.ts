import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Sandbox } from '@vercel/sandbox'
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
 * Step: Create sandbox and take snapshot
 */
async function createAndSnapshotStep(config: SnapshotConfig): Promise<string> {
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
  logger.log('snapshot', 'Taking snapshot...')

  // Take snapshot (this also stops the sandbox automatically)
  const snapshot = await sandbox.snapshot()

  logger.log('snapshot', `Snapshot created: ${snapshot.snapshotId}`)
  return snapshot.snapshotId
}

/**
 * Step: Store snapshot metadata
 */
async function storeSnapshotMetadataStep(
  snapshotId: string,
  sourceRepo: string,
): Promise<void> {
  'use step'

  const logger = getLogger()
  logger.log('snapshot', 'Storing snapshot metadata...')

  const metadata: SnapshotMetadata = {
    snapshotId,
    createdAt: Date.now(),
    sourceRepo,
  }

  // Check if we're in production (Upstash env vars are set)
  const isProduction = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

  if (isProduction) {
    // Use Upstash Redis in production
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
    await redis.set('snapshot:current', metadata)
    logger.log('snapshot', 'Snapshot metadata stored in Upstash Redis')
  }
  else {
    // Use filesystem in development
    const kvDir = join(process.cwd(), '.data', 'kv')
    const filePath = join(kvDir, 'snapshot:current.json')

    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, JSON.stringify(metadata, null, 2))
    logger.log('snapshot', `Snapshot metadata stored in ${filePath}`)
  }
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
    // Step 1: Create sandbox and take snapshot
    const snapshotId = await createAndSnapshotStep(config)

    // Step 2: Store snapshot metadata
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
