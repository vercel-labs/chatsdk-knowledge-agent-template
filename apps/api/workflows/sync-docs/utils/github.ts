import { mkdir, rm, writeFile, readdir, stat, unlink, rmdir } from 'node:fs/promises'
import { resolve, join, extname } from 'pathe'
import { downloadTemplate } from 'giget'
import type { GitHubSource, SyncResult, ContentFile } from '@savoir/config'

const ALLOWED_EXTENSIONS = new Set(['.md', '.mdx', '.yml', '.yaml', '.json'])

const EXCLUDED_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'composer.lock',
  'Gemfile.lock',
  'Cargo.lock',
  'Pipfile.lock',
  'poetry.lock',
  'uv.lock',
  'go.sum',
])

function isAllowedFile(filename: string): boolean {
  if (EXCLUDED_FILES.has(filename)) return false
  return ALLOWED_EXTENSIONS.has(extname(filename).toLowerCase())
}

export async function cleanupNonDocFiles(dir: string): Promise<number> {
  let mdCount = 0

  async function processDir(currentDir: string): Promise<void> {
    let entries: string[]
    try {
      entries = await readdir(currentDir)
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry)
      let stats
      try {
        stats = await stat(fullPath)
      } catch {
        continue
      }

      if (stats.isDirectory()) {
        await processDir(fullPath)
        try {
          const remaining = await readdir(fullPath)
          if (remaining.length === 0) await rmdir(fullPath)
        } catch {}
      } else if (stats.isFile()) {
        if (isAllowedFile(entry)) {
          if (entry.endsWith('.md') || entry.endsWith('.mdx')) mdCount++
        } else {
          try {
            await unlink(fullPath)
          } catch {}
        }
      }
    }
  }

  await processDir(dir)
  return mdCount
}

export async function fetchReadme(repo: string, branch: string): Promise<string> {
  const response = await fetch(
    `https://raw.githubusercontent.com/${repo}/${branch}/README.md`
  )
  if (!response.ok) {
    throw new Error(`Failed to fetch README from ${repo}: ${response.statusText}`)
  }
  return response.text()
}

export async function syncGitHubSource(
  source: GitHubSource,
  outputDir: string
): Promise<SyncResult> {
  const startTime = Date.now()
  const outputFolder = source.outputPath || source.id
  const targetDir = resolve(outputDir, 'docs', outputFolder)

  try {
    await mkdir(targetDir, { recursive: true })

    if (source.readmeOnly) {
      const content = await fetchReadme(source.repo, source.branch)
      await writeFile(resolve(targetDir, 'README.md'), content, 'utf-8')
      return {
        sourceId: source.id,
        success: true,
        fileCount: 1,
        duration: Date.now() - startTime,
      }
    }

    const template = `gh:${source.repo}/${source.contentPath}#${source.branch}`
    await downloadTemplate(template, { dir: targetDir, force: true })

    const mdCount = await cleanupNonDocFiles(targetDir)

    if (source.additionalSyncs) {
      for (const additional of source.additionalSyncs) {
        const additionalTemplate = `gh:${additional.repo}/${additional.contentPath}#${additional.branch}`
        try {
          await downloadTemplate(additionalTemplate, { dir: targetDir, force: true })
          await cleanupNonDocFiles(targetDir)
        } catch (error) {
          console.warn(`[${source.id}] Additional sync failed for ${additional.repo}:`, error)
        }
      }
    }

    return {
      sourceId: source.id,
      success: true,
      fileCount: mdCount,
      duration: Date.now() - startTime,
    }
  } catch (error) {
    return {
      sourceId: source.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    }
  }
}

export async function resetSourceDir(source: GitHubSource, outputDir: string): Promise<void> {
  const targetDir = resolve(outputDir, 'docs', source.outputPath || source.id)
  try {
    await rm(targetDir, { recursive: true, force: true })
  } catch {}
}

export async function collectFiles(dir: string, basePath = ''): Promise<ContentFile[]> {
  const files: ContentFile[] = []

  async function processDir(currentDir: string, relativePath: string): Promise<void> {
    let entries: string[]
    try {
      entries = await readdir(currentDir)
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry)
      const relPath = relativePath ? `${relativePath}/${entry}` : entry

      let stats
      try {
        stats = await stat(fullPath)
      } catch {
        continue
      }

      if (stats.isDirectory()) {
        await processDir(fullPath, relPath)
      } else if (stats.isFile() && isAllowedFile(entry)) {
        const { readFile } = await import('node:fs/promises')
        const content = await readFile(fullPath, 'utf-8')
        files.push({ path: relPath, content })
      }
    }
  }

  await processDir(dir, basePath)
  return files
}
