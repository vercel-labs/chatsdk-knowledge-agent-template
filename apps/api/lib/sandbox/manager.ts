import { Sandbox } from '@vercel/sandbox'
import { getLogger } from '@savoir/logger'
import { useRuntimeConfig } from 'nitro/runtime-config'
import type { ActiveSandbox, FileContent, SearchAndReadResult, SearchResult, SandboxManagerConfig } from './types'
import { getSnapshotIdOrThrow } from './snapshot'
import { deleteSession, generateSessionId, getSession, setSession, touchSession } from './session'

const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes
const SANDBOX_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Get sandbox configuration from runtime config
 */
function getConfig(): SandboxManagerConfig {
  const config = useRuntimeConfig()
  return {
    githubToken: config.githubToken as string | undefined,
    snapshotRepo: config.snapshotRepo as string,
    snapshotBranch: (config.snapshotBranch as string) || 'main',
    sessionTtlMs: DEFAULT_SESSION_TTL_MS,
  }
}

/**
 * Build git source options with authentication for private repos
 */
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

/**
 * Create a new sandbox from the current snapshot
 */
async function createSandboxFromSnapshot(snapshotId: string): Promise<Sandbox> {
  const logger = getLogger()

  logger.log('sandbox', `Creating sandbox from snapshot: ${snapshotId}`)

  const sandbox = await Sandbox.create({
    source: {
      type: 'snapshot',
      snapshotId,
    },
    timeout: SANDBOX_TIMEOUT_MS,
    runtime: 'node24',
  })

  logger.log('sandbox', `Sandbox created: ${sandbox.sandboxId}`)
  return sandbox
}

/**
 * Get an existing sandbox by ID or return null if not available
 */
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

/**
 * Get or create a sandbox for a session
 * If sessionId is provided, will try to reuse an existing sandbox
 */
export async function getOrCreateSandbox(sessionId?: string): Promise<ActiveSandbox> {
  const logger = getLogger()
  const config = getConfig()

  // If session ID provided, try to get existing sandbox
  if (sessionId) {
    const session = await getSession(sessionId)
    if (session) {
      const sandbox = await getSandboxById(session.sandboxId)
      if (sandbox) {
        logger.log('sandbox', `Reusing sandbox ${sandbox.sandboxId} for session ${sessionId}`)
        await touchSession(sessionId, config.sessionTtlMs)
        return { sandbox, session }
      }
      // Sandbox no longer available, clean up session
      await deleteSession(sessionId)
    }
  }

  // Create new sandbox
  const snapshotId = await getSnapshotIdOrThrow()
  const sandbox = await createSandboxFromSnapshot(snapshotId)

  // Create session
  const newSessionId = sessionId || generateSessionId()
  const session = await setSession(
    newSessionId,
    {
      sandboxId: sandbox.sandboxId,
      snapshotId,
      createdAt: Date.now(),
    },
    config.sessionTtlMs,
  )

  return { sandbox, session }
}

/**
 * Search files in sandbox using ripgrep
 */
export async function search(
  sandbox: Sandbox,
  query: string,
  limit: number = 20,
): Promise<SearchResult[]> {
  const logger = getLogger()
  logger.log('sandbox', `Searching for: ${query}`)

  // Use ripgrep for searching (installed by default in sandbox)
  const result = await sandbox.runCommand({
    cmd: 'rg',
    args: [
      '--json',
      '--max-count',
      String(limit),
      '--type',
      'md',
      '--type',
      'yaml',
      '--type',
      'json',
      query,
      '/vercel/sandbox',
    ],
    cwd: '/vercel/sandbox',
  })

  const stdout = await result.stdout()
  const lines = stdout.split('\n').filter(Boolean)

  const results: SearchResult[] = []
  for (const line of lines) {
    try {
      const json = JSON.parse(line)
      if (json.type === 'match') {
        results.push({
          path: json.data.path.text.replace('/vercel/sandbox/', ''),
          lineNumber: json.data.line_number,
          content: json.data.lines.text.trim(),
        })
      }
    } catch {
      // Skip malformed lines
    }
  }

  logger.log('sandbox', `Found ${results.length} matches`)
  return results
}

/**
 * Read files from sandbox
 */
export async function read(
  sandbox: Sandbox,
  paths: string[],
): Promise<FileContent[]> {
  const logger = getLogger()
  logger.log('sandbox', `Reading ${paths.length} files`)

  const files: FileContent[] = []

  for (const path of paths) {
    try {
      const buffer = await sandbox.readFileToBuffer({
        path,
        cwd: '/vercel/sandbox',
      })

      if (buffer) {
        files.push({
          path,
          content: buffer.toString('utf-8'),
        })
      }
    } catch (error) {
      logger.log('sandbox', `Failed to read file: ${path}`)
    }
  }

  logger.log('sandbox', `Read ${files.length} files successfully`)
  return files
}

/**
 * Search and read files in a single operation
 * Returns matching search results and full file contents for unique files
 */
export async function searchAndRead(
  sandbox: Sandbox,
  query: string,
  limit: number = 20,
): Promise<SearchAndReadResult> {
  // Search for matches
  const matches = await search(sandbox, query, limit)

  // Get unique file paths
  const uniquePaths = [...new Set(matches.map(m => m.path))]

  // Read the unique files
  const files = await read(sandbox, uniquePaths)

  return { matches, files }
}

/**
 * Create a new sandbox from a git repository and take a snapshot
 * Supports private repos via GitHub token authentication
 */
export async function createSnapshotFromRepo(repoUrl: string, branch: string = 'main'): Promise<string> {
  const config = getConfig()
  const logger = getLogger()

  logger.log('sandbox', `Creating sandbox from repo: ${repoUrl}#${branch}`)

  const sandbox = await Sandbox.create({
    source: getGitSourceOptions(repoUrl, branch, config.githubToken),
    timeout: SANDBOX_TIMEOUT_MS,
    runtime: 'node24',
  })

  logger.log('sandbox', `Sandbox created: ${sandbox.sandboxId}, taking snapshot...`)

  // Take snapshot (this also stops the sandbox)
  const snapshot = await sandbox.snapshot()

  logger.log('sandbox', `Snapshot created: ${snapshot.snapshotId}`)
  return snapshot.snapshotId
}
