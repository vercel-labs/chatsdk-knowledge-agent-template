import type { Sandbox } from '@vercel/sandbox'
import { createError, log } from 'evlog'
import type { FileSource, GitHubSource, Source, SyncSourceResult } from '../../workflows/sync-docs/types'

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
      return { sourceId: source.id, label: source.label, success: true, fileCount }
    }

    const fileCount = await syncFullRepository(sandbox, source, targetDir)
    return { sourceId: source.id, label: source.label, success: true, fileCount }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { sourceId: source.id, label: source.label, success: false, fileCount: 0, error: errorMessage }
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

/** Writes pre-loaded file contents to sandbox */
export async function syncFileSource(
  sandbox: Sandbox,
  source: FileSource,
): Promise<SyncSourceResult> {
  const basePath = source.basePath || '/files'
  const outputPath = source.outputPath || source.id
  const targetDir = `/vercel/sandbox${basePath}/${outputPath}`

  try {
    log.info('sync', `Starting file sync for "${source.label}"`)

    await sandbox.runCommand({
      cmd: 'mkdir',
      args: ['-p', targetDir],
      cwd: '/vercel/sandbox',
    })

    if (source.files.length === 0) {
      log.info('sync', `No files provided for "${source.label}"`)
      return { sourceId: source.id, label: source.label, success: true, fileCount: 0 }
    }

    let fileCount = 0

    for (const entry of source.files) {
      try {
        const filepath = `${targetDir}/${entry.filename}`

        await sandbox.runCommand({
          cmd: 'sh',
          args: ['-c', `cat > '${filepath}' << 'EOFMARKER'\n${entry.content}\nEOFMARKER`],
          cwd: '/vercel/sandbox',
        })

        fileCount++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        log.warn('sync', `Failed to sync file ${entry.filename}: ${errorMessage}`)
      }
    }

    log.info('sync', `File sync completed for "${source.label}": ${fileCount} files`)

    return { sourceId: source.id, label: source.label, success: true, fileCount }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error('sync', `File sync failed for "${source.label}": ${errorMessage}`)
    return { sourceId: source.id, label: source.label, success: false, fileCount: 0, error: errorMessage }
  }
}

/** Removes directories in the sandbox that don't belong to any active source */
export async function cleanupStaleSources(
  sandbox: Sandbox,
  sources: Source[],
): Promise<string[]> {
  const expectedDirs = new Map<string, Set<string>>()

  for (const source of sources) {
    const basePath = source.basePath || (source.type === 'file' ? '/files' : '/docs')
    const outputPath = source.outputPath || source.id
    if (!expectedDirs.has(basePath)) {
      expectedDirs.set(basePath, new Set())
    }
    expectedDirs.get(basePath)!.add(outputPath)
  }

  const removed: string[] = []
  const basePaths = new Set(['/docs', '/files', '/youtube', ...expectedDirs.keys()])

  for (const basePath of basePaths) {
    const fullBase = `/vercel/sandbox${basePath}`
    const result = await sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', `[ -d '${fullBase}' ] && ls -1 '${fullBase}' || true`],
      cwd: '/vercel/sandbox',
    })

    const output = (await result.stdout()).trim()
    if (!output) continue

    const existingDirs = output.split('\n').filter(Boolean)
    const expected = expectedDirs.get(basePath) || new Set()

    for (const dir of existingDirs) {
      if (!expected.has(dir)) {
        const staleDir = `${fullBase}/${dir}`
        log.info('sync', `Removing stale source directory: ${staleDir}`)
        await sandbox.runCommand({
          cmd: 'rm',
          args: ['-rf', staleDir],
          cwd: '/vercel/sandbox',
        })
        removed.push(`${basePath}/${dir}`)
      }
    }
  }

  return removed
}

/** Syncs all sources sequentially, returns array of results */
export async function syncSources(
  sandbox: Sandbox,
  sources: Source[],
): Promise<SyncSourceResult[]> {
  const results: SyncSourceResult[] = []

  for (const source of sources) {
    let result: SyncSourceResult

    if (source.type === 'github') {
      result = await syncGitHubSource(sandbox, source)
    } else if (source.type === 'file') {
      result = await syncFileSource(sandbox, source)
    } else {
      const unknownSource = source as Source
      result = {
        sourceId: unknownSource.id,
        label: unknownSource.label,
        success: false,
        fileCount: 0,
        error: `Unsupported source type: ${unknownSource.type}`,
      }
    }

    results.push(result)
  }

  return results
}
