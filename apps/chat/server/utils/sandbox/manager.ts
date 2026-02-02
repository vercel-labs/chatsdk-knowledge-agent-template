import { Sandbox } from '@vercel/sandbox'
import { createError, log } from 'evlog'
import type { ActiveSandbox, FileContent, SearchAndReadResult, SearchResult, SandboxManagerConfig, SnapshotMetadata } from './types'
import { getCurrentSnapshot, setCurrentSnapshot } from './snapshot'
import { deleteSandboxSession, generateSessionId, getSandboxSession, setSandboxSession, touchSandboxSession } from './session'

const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes
const SANDBOX_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

/** Returns sandbox configuration from runtime environment */
function getConfig(): SandboxManagerConfig {
  const config = useRuntimeConfig()
  return {
    githubToken: config.github.token,
    snapshotRepo: config.github.snapshotRepo,
    snapshotBranch: config.github.snapshotBranch,
    sessionTtlMs: DEFAULT_SESSION_TTL_MS,
  }
}

/** Creates git source config with optional authentication for private repos */
function getGitSourceOptions(repoUrl: string, branch: string, githubToken?: string) {
  const source: {
    type: 'git'
    url: string
    revision?: string
    username?: string
    password?: string
  } = {
    type: 'git',
    url: repoUrl,
    revision: branch,
  }

  // Add GitHub credentials for private repos
  if (githubToken) {
    source.username = 'x-access-token'
    source.password = githubToken
  }

  return source
}

/** Creates and initializes sandbox from snapshot ID */
async function createSandboxFromSnapshot(snapshotId: string): Promise<Sandbox> {
  log.info('sandbox', `Creating sandbox from snapshot: ${snapshotId}`)
  const startTime = Date.now()

  const sandbox = await Sandbox.create({
    source: {
      type: 'snapshot',
      snapshotId,
    },
    timeout: SANDBOX_TIMEOUT_MS,
    runtime: 'node24',
  })

  const durationMs = Date.now() - startTime
  log.info('sandbox', `Sandbox created: ${sandbox.sandboxId} (${durationMs}ms)`)
  return sandbox
}

/** Returns sandbox if running, null otherwise */
async function getSandboxById(sandboxId: string): Promise<Sandbox | null> {
  try {
    const sandbox = await Sandbox.get({ sandboxId })

    if (sandbox.status !== 'running') {
      return null
    }

    return sandbox
  } catch {
    return null
  }
}

/** Creates sandbox from git repository and returns snapshot ID */
export async function createSnapshotFromRepo(repoUrl: string, branch: string = 'main'): Promise<string> {
  const config = getConfig()

  log.info('sandbox', `Creating sandbox from repo: ${repoUrl}#${branch}`)

  const sandbox = await Sandbox.create({
    source: getGitSourceOptions(repoUrl, branch, config.githubToken),
    timeout: SANDBOX_TIMEOUT_MS,
    runtime: 'node24',
  })

  log.info('sandbox', `Sandbox created: ${sandbox.sandboxId}, taking snapshot...`)

  // Take snapshot (this also stops the sandbox)
  const snapshot = await sandbox.snapshot()

  log.info('sandbox', `Snapshot created: ${snapshot.snapshotId}`)
  return snapshot.snapshotId
}

/** Returns current snapshot ID or creates one from configured repo */
async function getOrCreateSnapshot(): Promise<string> {
  const config = getConfig()

  // Check if snapshot exists
  const snapshot = await getCurrentSnapshot()
  if (snapshot) {
    return snapshot.snapshotId
  }

  // No snapshot exists, create one from the repo
  if (!config.snapshotRepo) {
    throw createError({
      message: 'No snapshot available',
      why: 'NUXT_GITHUB_SNAPSHOT_REPO environment variable is not configured',
      fix: 'Set NUXT_GITHUB_SNAPSHOT_REPO to your snapshot repository (e.g., "owner/repo")',
    })
  }

  const repoUrl = `https://github.com/${config.snapshotRepo}.git`
  const snapshotId = await createSnapshotFromRepo(repoUrl, config.snapshotBranch)

  // Save the snapshot metadata
  const metadata: SnapshotMetadata = {
    snapshotId,
    createdAt: Date.now(),
    sourceRepo: config.snapshotRepo,
  }
  await setCurrentSnapshot(metadata)

  log.info('sandbox', `Snapshot created and saved: ${snapshotId}`)
  return snapshotId
}

/** Returns active sandbox for session, reusing existing or creating new. Auto-creates snapshot if needed */
export async function getOrCreateSandbox(sessionId?: string): Promise<ActiveSandbox> {
  const config = getConfig()
  const startTime = Date.now()

  // If session ID provided, try to get existing sandbox
  if (sessionId) {
    const session = await getSandboxSession(sessionId)
    if (session) {
      const sandbox = await getSandboxById(session.sandboxId)
      if (sandbox) {
        const reuseMs = Date.now() - startTime
        log.info('sandbox', `Reusing sandbox ${sandbox.sandboxId} for session ${sessionId} (${reuseMs}ms)`)
        await touchSandboxSession(sessionId, config.sessionTtlMs)
        return { sandbox, session, sessionId }
      }
      // Sandbox no longer available, clean up session
      await deleteSandboxSession(sessionId)
    }
  }

  const snapshotId = await getOrCreateSnapshot()
  const sandbox = await createSandboxFromSnapshot(snapshotId)

  const newSessionId = sessionId || generateSessionId()
  const session = await setSandboxSession(
    newSessionId,
    {
      sandboxId: sandbox.sandboxId,
      snapshotId,
      createdAt: Date.now(),
    },
    config.sessionTtlMs,
  )

  const createMs = Date.now() - startTime
  log.info('sandbox', `New sandbox created for session ${newSessionId} (${createMs}ms)`)

  return { sandbox, session, sessionId: newSessionId }
}

/**
 * Search files in sandbox using grep (more widely available than ripgrep)
 */
export async function search(
  sandbox: Sandbox,
  query: string,
  limit: number = 20,
): Promise<SearchResult[]> {
  log.info('sandbox', `Searching for: ${query}`)
  const startTime = Date.now()

  // Use grep for searching (-r recursive, -n line numbers, -i case insensitive, -l list files)
  const result = await sandbox.runCommand({
    cmd: 'grep',
    args: [
      '-r', // Recursive
      '-n', // Line numbers
      '-i', // Case insensitive
      '-H', // Print filename
      '--include=*.md',
      '--include=*.yaml',
      '--include=*.yml',
      '--include=*.json',
      '--include=*.ts',
      '--include=*.js',
      query,
      '.',
    ],
    cwd: '/vercel/sandbox',
  })

  const grepMs = Date.now() - startTime

  const stdout = await result.stdout()
  const stderr = await result.stderr()

  if (stderr) {
    log.error('sandbox', `grep stderr: ${stderr}`)
  }

  const lines = stdout.split('\n').filter(Boolean).slice(0, limit)

  const results: SearchResult[] = []
  for (const line of lines) {
    // grep output format: ./path/to/file:lineNumber:content
    const match = line.match(/^\.\/(.+?):(\d+):(.*)$/)
    if (match && match[1] && match[2] && match[3]) {
      results.push({
        path: match[1],
        lineNumber: parseInt(match[2], 10),
        content: match[3].trim(),
      })
    }
  }

  log.info('sandbox', `Found ${results.length} matches (grep: ${grepMs}ms)`)
  return results
}

/** Reads files at paths from sandbox and returns contents, in parallel for better performance */
export async function read(
  sandbox: Sandbox,
  paths: string[],
): Promise<FileContent[]> {
  log.info('sandbox', `Reading ${paths.length} files`)
  const startTime = Date.now()

  const files = await Promise.all(paths.map(async (path) => {
    try {
      const buffer = await sandbox.readFileToBuffer({
        path,
        cwd: '/vercel/sandbox',
      })

      if (buffer) {
        return {
          path,
          content: buffer.toString('utf-8'),
        }
      }
    } catch {
      log.error('sandbox', `Failed to read file: ${path}`)
    }
    return null
  }))

  // Filter out any failed reads (nulls)
  const filteredFiles = files.filter((f): f is FileContent => !!f)

  const readMs = Date.now() - startTime
  log.info('sandbox', `Read ${filteredFiles.length} files successfully (${readMs}ms)`)
  return filteredFiles
}

/**
 * Searches for query and returns matches with context snippets.
 *
 * Optimizations:
 * 1. Occurrence-based ranking - files with more matches are more relevant
 * 2. Limited file reads - only top 3 most relevant files
 * 3. Context snippets - only lines around matches, not full files
 */
export async function searchAndRead(
  sandbox: Sandbox,
  query: string,
  limit: number = 20,
): Promise<SearchAndReadResult> {
  // Search for matches
  const matches = await search(sandbox, query, limit)

  if (matches.length === 0) {
    return { matches: [], files: [] }
  }

  // Count occurrences per file and rank by relevance
  const fileOccurrences = new Map<string, number>()
  for (const match of matches) {
    fileOccurrences.set(match.path, (fileOccurrences.get(match.path) || 0) + 1)
  }

  // Sort files by occurrence count (most relevant first)
  const rankedFiles = [...fileOccurrences.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([path]) => path)

  // Only read top 3 most relevant files (to avoid context explosion)
  const topFiles = rankedFiles.slice(0, 3)

  log.info('sandbox', `Ranked ${rankedFiles.length} files, reading top ${topFiles.length}`)

  // Read files with context snippets instead of full content
  const files = await readWithContext(sandbox, topFiles, matches)

  return { matches, files }
}

/**
 * Read files but only include lines around matches (context snippets).
 * This prevents context explosion from large files.
 */
async function readWithContext(
  sandbox: Sandbox,
  paths: string[],
  matches: SearchResult[],
  contextLines: number = 10,
): Promise<FileContent[]> {
  const startTime = Date.now()

  const files = await Promise.all(paths.map(async (path) => {
    try {
      const buffer = await sandbox.readFileToBuffer({
        path,
        cwd: '/vercel/sandbox',
      })

      if (!buffer) {
        return null
      }

      const fullContent = buffer.toString('utf-8')
      const lines = fullContent.split('\n')

      // Get line numbers with matches in this file
      const matchLines = matches
        .filter(m => m.path === path)
        .map(m => m.lineNumber)

      // Build a set of lines to include (match lines + context)
      const linesToInclude = new Set<number>()
      for (const lineNum of matchLines) {
        for (let i = Math.max(1, lineNum - contextLines); i <= Math.min(lines.length, lineNum + contextLines); i++) {
          linesToInclude.add(i)
        }
      }

      // Build content with only relevant lines
      // Group consecutive lines into snippets
      const sortedLines = [...linesToInclude].sort((a, b) => a - b)
      const snippets: string[] = []
      let currentSnippet: string[] = []
      let lastLine = -1

      for (const lineNum of sortedLines) {
        if (lastLine !== -1 && lineNum > lastLine + 1) {
          // Gap in lines - save current snippet and start new one
          if (currentSnippet.length > 0) {
            snippets.push(currentSnippet.join('\n'))
            currentSnippet = []
          }
          snippets.push('...')
        }

        const lineContent = lines[lineNum - 1] // 0-indexed
        if (lineContent !== undefined) {
          currentSnippet.push(`${lineNum}: ${lineContent}`)
        }
        lastLine = lineNum
      }

      // Don't forget the last snippet
      if (currentSnippet.length > 0) {
        snippets.push(currentSnippet.join('\n'))
      }

      const contextContent = snippets.join('\n')

      return {
        path,
        content: contextContent,
        matchCount: matchLines.length,
        totalLines: lines.length,
      }
    } catch {
      return null
    }
  }))

  const filteredFiles: FileContent[] = files.filter((f) => f !== null)
  const readMs = Date.now() - startTime

  log.info('sandbox', `Read ${filteredFiles.length} files with context (${readMs}ms)`)
  return filteredFiles
}
