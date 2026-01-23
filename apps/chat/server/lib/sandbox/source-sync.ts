import type { Sandbox } from '@vercel/sandbox'
import { createError } from '@savoir/logger'
import type { GitHubSource, SyncSourceResult } from '../../workflows/sync-docs/types'

/** Syncs GitHub source to sandbox, returns result with file count and status */
export async function syncGitHubSource(
  sandbox: Sandbox,
  source: GitHubSource,
): Promise<SyncSourceResult> {
  const basePath = source.basePath || '/docs'
  const outputPath = source.outputPath || source.id
  const targetDir = `/vercel/sandbox${basePath}/${outputPath}`

  try {
    await sandbox.runCommand({
      cmd: 'mkdir',
      args: ['-p', targetDir],
      cwd: '/vercel/sandbox',
    })

    if (source.readmeOnly) {
      const fileCount = await syncReadmeOnly(sandbox, source, targetDir)
      return { sourceId: source.id, success: true, fileCount }
    }

    const fileCount = await syncFullRepository(sandbox, source, targetDir)
    return { sourceId: source.id, success: true, fileCount }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { sourceId: source.id, success: false, fileCount: 0, error: errorMessage }
  }
}

/** Fetches and saves README.md from repository to target directory */
async function syncReadmeOnly(
  sandbox: Sandbox,
  source: GitHubSource,
  targetDir: string,
): Promise<number> {
  const readmeUrl = `https://raw.githubusercontent.com/${source.repo}/${source.branch}/README.md`

  const result = await sandbox.runCommand({
    cmd: 'curl',
    args: ['-sL', '-o', `${targetDir}/README.md`, readmeUrl],
    cwd: '/vercel/sandbox',
  })

  if (result.exitCode !== 0) {
    throw createError({
      message: `Failed to fetch README from ${source.repo}`,
      why: await result.stderr(),
      fix: 'Ensure the repository is public or token has access, and README.md exists',
    })
  }

  return 1
}

/** Clones repository with sparse checkout, copies content path, and filters to keep only docs files */
async function syncFullRepository(
  sandbox: Sandbox,
  source: GitHubSource,
  targetDir: string,
): Promise<number> {
  const contentPath = source.contentPath || ''
  const tempDir = `/tmp/sync-${source.id}-${Date.now()}`

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
    throw createError({
      message: `Failed to clone repository ${source.repo}`,
      why: stderr,
      fix: 'Check that the repository exists, branch is correct, and token has access if private',
    })
  }

  const sourcePath = contentPath ? `${tempDir}/${contentPath}` : tempDir
  await sandbox.runCommand({
    cmd: 'sh',
    args: ['-c', `cp -r ${sourcePath}/* ${targetDir}/ 2>/dev/null || cp -r ${sourcePath}/. ${targetDir}/`],
    cwd: '/vercel/sandbox',
  })

  await sandbox.runCommand({
    cmd: 'sh',
    args: [
      '-c',
      `find ${targetDir} -type f ! \\( -name "*.md" -o -name "*.mdx" -o -name "*.yml" -o -name "*.yaml" -o -name "*.json" \\) -delete`,
    ],
    cwd: '/vercel/sandbox',
  })

  await sandbox.runCommand({
    cmd: 'sh',
    args: ['-c', `find ${targetDir} -type d -empty -delete`],
    cwd: '/vercel/sandbox',
  })

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

  return parseInt((await countResult.stdout()).trim()) || 0
}

/** Syncs all sources sequentially, returns array of results */
export async function syncSources(
  sandbox: Sandbox,
  sources: GitHubSource[],
): Promise<SyncSourceResult[]> {
  const results: SyncSourceResult[] = []

  for (const source of sources) {
    const result = await syncGitHubSource(sandbox, source)
    results.push(result)
  }

  return results
}
