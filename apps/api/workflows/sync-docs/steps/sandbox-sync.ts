import { Sandbox } from '@vercel/sandbox'
import { getLogger } from '@savoir/logger'
import type { GitHubSource, SyncResult } from '@savoir/config'

interface SyncInSandboxResult {
  snapshotId: string
  results: SyncResult[]
}

/**
 * Sync all sources inside a sandbox and return the snapshot ID.
 *
 * This is a single step because the Sandbox object is not serializable
 * and cannot be passed between workflow steps.
 */
export async function syncAllSourcesInSandbox(
  sources: GitHubSource[],
  snapshotRepo: string,
  snapshotBranch: string,
  githubToken?: string,
): Promise<SyncInSandboxResult> {
  'use step'

  const logger = getLogger()
  const repoUrl = `https://github.com/${snapshotRepo}.git`

  logger.log('sync', `Creating sandbox from ${snapshotRepo}#${snapshotBranch}`)

  // Create sandbox from snapshot repo
  const source: {
    type: 'git'
    url: string
    revision: string
    username?: string
    password?: string
  } = {
    type: 'git',
    url: repoUrl,
    revision: snapshotBranch,
  }

  if (githubToken) {
    source.username = 'x-access-token'
    source.password = githubToken
  }

  const sandbox = await Sandbox.create({
    source,
    timeout: 10 * 60 * 1000, // 10 minutes
    runtime: 'node24',
  })

  logger.log('sync', `Sandbox created: ${sandbox.sandboxId}`)

  // Sync each source
  const results: SyncResult[] = []

  for (const src of sources) {
    const result = await syncSource(sandbox, src, logger)
    results.push(result)
  }

  logger.log('sync', 'Taking snapshot...')
  const snapshot = await sandbox.snapshot()
  logger.log('sync', `Snapshot created: ${snapshot.snapshotId}`)

  return {
    snapshotId: snapshot.snapshotId,
    results,
  }
}

/**
 * Sync a single source inside the sandbox (internal function, not a step)
 */
async function syncSource(
  sandbox: Sandbox,
  source: GitHubSource,
  logger: ReturnType<typeof getLogger>,
): Promise<SyncResult> {
  const outputPath = source.outputPath || source.id
  const targetDir = `/vercel/sandbox/docs/${outputPath}`

  logger.log('sync', `Syncing ${source.id} to ${targetDir}`)

  try {
    // Create target directory
    await sandbox.runCommand({
      cmd: 'mkdir',
      args: ['-p', targetDir],
      cwd: '/vercel/sandbox',
    })

    if (source.readmeOnly) {
      // Just fetch the README
      const readmeUrl = `https://raw.githubusercontent.com/${source.repo}/${source.branch}/README.md`
      const result = await sandbox.runCommand({
        cmd: 'curl',
        args: ['-sL', '-o', `${targetDir}/README.md`, readmeUrl],
        cwd: '/vercel/sandbox',
      })

      if (result.exitCode !== 0) {
        throw new Error(`Failed to fetch README: ${await result.stderr()}`)
      }

      return { sourceId: source.id, success: true, fileCount: 1 }
    }

    // Clone the content path from the repo
    const contentPath = source.contentPath || ''
    const tempDir = `/tmp/sync-${source.id}-${Date.now()}`

    // Clone repo to temp dir (sparse checkout for specific path)
    const cloneResult = await sandbox.runCommand({
      cmd: 'sh',
      args: [
        '-c',
        [
          `git clone --depth 1 --single-branch --branch ${source.branch}`,
          `--filter=blob:none --sparse`,
          `https://github.com/${source.repo}.git ${tempDir}`,
          `&& cd ${tempDir}`,
          `&& git sparse-checkout set ${contentPath || '.'}`,
        ].join(' '),
      ],
      cwd: '/vercel/sandbox',
    })

    if (cloneResult.exitCode !== 0) {
      const stderr = await cloneResult.stderr()
      throw new Error(`Git clone failed: ${stderr}`)
    }

    // Copy content to target dir
    const sourcePath = contentPath ? `${tempDir}/${contentPath}` : tempDir
    await sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', `cp -r ${sourcePath}/* ${targetDir}/ 2>/dev/null || cp -r ${sourcePath}/. ${targetDir}/`],
      cwd: '/vercel/sandbox',
    })

    // Clean up non-doc files (keep only .md, .mdx, .yml, .yaml, .json)
    await sandbox.runCommand({
      cmd: 'sh',
      args: [
        '-c',
        `find ${targetDir} -type f ! \\( -name "*.md" -o -name "*.mdx" -o -name "*.yml" -o -name "*.yaml" -o -name "*.json" \\) -delete`,
      ],
      cwd: '/vercel/sandbox',
    })

    // Remove empty directories
    await sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', `find ${targetDir} -type d -empty -delete`],
      cwd: '/vercel/sandbox',
    })

    // Cleanup temp dir
    await sandbox.runCommand({
      cmd: 'rm',
      args: ['-rf', tempDir],
      cwd: '/vercel/sandbox',
    })

    const countResult = await sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', `find ${targetDir} -type f -name "*.md" -o -name "*.mdx" | wc -l`],
      cwd: '/vercel/sandbox',
    })

    const fileCount = parseInt((await countResult.stdout()).trim()) || 0

    logger.log('sync', `${source.id}: synced ${fileCount} files`)
    return { sourceId: source.id, success: true, fileCount }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.log('sync', `${source.id}: failed - ${errorMessage}`)
    return { sourceId: source.id, success: false, fileCount: 0, error: errorMessage }
  }
}
