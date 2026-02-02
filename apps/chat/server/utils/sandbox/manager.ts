import { Sandbox } from '@vercel/sandbox'
import { createError, log } from 'evlog'
import type { ActiveSandbox, SandboxManagerConfig, SnapshotMetadata } from './types'
import { getCurrentSnapshot, setCurrentSnapshot } from './snapshot'
import { deleteSandboxSession, generateSessionId, getSandboxSession, setSandboxSession, touchSandboxSession } from './session'

const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000
const SANDBOX_TIMEOUT_MS = 5 * 60 * 1000

function getConfig(): SandboxManagerConfig {
  const config = useRuntimeConfig()
  return {
    githubToken: config.github.token,
    snapshotRepo: config.github.snapshotRepo,
    snapshotBranch: config.github.snapshotBranch,
    sessionTtlMs: DEFAULT_SESSION_TTL_MS,
  }
}

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

  if (githubToken) {
    source.username = 'x-access-token'
    source.password = githubToken
  }

  return source
}

async function createSandboxFromSnapshot(snapshotId: string): Promise<Sandbox> {
  log.info('sandbox', `Creating sandbox from snapshot: ${snapshotId}`)
  const startTime = Date.now()

  const sandbox = await Sandbox.create({
    source: { type: 'snapshot', snapshotId },
    timeout: SANDBOX_TIMEOUT_MS,
    runtime: 'node24',
  })

  log.info('sandbox', `Sandbox created: ${sandbox.sandboxId} (${Date.now() - startTime}ms)`)
  return sandbox
}

async function getSandboxById(sandboxId: string): Promise<Sandbox | null> {
  try {
    const sandbox = await Sandbox.get({ sandboxId })
    return sandbox.status === 'running' ? sandbox : null
  } catch {
    return null
  }
}

export async function createSnapshotFromRepo(repoUrl: string, branch: string = 'main'): Promise<string> {
  const config = getConfig()

  log.info('sandbox', `Creating sandbox from repo: ${repoUrl}#${branch}`)

  const sandbox = await Sandbox.create({
    source: getGitSourceOptions(repoUrl, branch, config.githubToken),
    timeout: SANDBOX_TIMEOUT_MS,
    runtime: 'node24',
  })

  log.info('sandbox', `Sandbox created: ${sandbox.sandboxId}, taking snapshot...`)

  const snapshot = await sandbox.snapshot()

  log.info('sandbox', `Snapshot created: ${snapshot.snapshotId}`)
  return snapshot.snapshotId
}

async function getOrCreateSnapshot(): Promise<string> {
  const config = getConfig()

  const snapshot = await getCurrentSnapshot()
  if (snapshot) {
    return snapshot.snapshotId
  }

  if (!config.snapshotRepo) {
    throw createError({
      message: 'No snapshot available',
      why: 'NUXT_GITHUB_SNAPSHOT_REPO environment variable is not configured',
      fix: 'Set NUXT_GITHUB_SNAPSHOT_REPO to your snapshot repository',
    })
  }

  const repoUrl = `https://github.com/${config.snapshotRepo}.git`
  const snapshotId = await createSnapshotFromRepo(repoUrl, config.snapshotBranch)

  const metadata: SnapshotMetadata = {
    snapshotId,
    createdAt: Date.now(),
    sourceRepo: config.snapshotRepo,
  }
  await setCurrentSnapshot(metadata)

  log.info('sandbox', `Snapshot created and saved: ${snapshotId}`)
  return snapshotId
}

export async function getOrCreateSandbox(sessionId?: string): Promise<ActiveSandbox> {
  const config = getConfig()
  const startTime = Date.now()

  if (sessionId) {
    const session = await getSandboxSession(sessionId)
    if (session) {
      const sandbox = await getSandboxById(session.sandboxId)
      if (sandbox) {
        log.info('sandbox', `Reusing sandbox ${sandbox.sandboxId} for session ${sessionId} (${Date.now() - startTime}ms)`)
        await touchSandboxSession(sessionId, config.sessionTtlMs)
        return { sandbox, session, sessionId }
      }
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

  log.info('sandbox', `New sandbox created for session ${newSessionId} (${Date.now() - startTime}ms)`)

  return { sandbox, session, sessionId: newSessionId }
}
