import { Sandbox } from '@vercel/sandbox'
import type { SyncConfig } from '../../workflows/sync-docs/types'

export interface SandboxSource {
  type: 'git'
  url: string
  revision: string
  username?: string
  password?: string
}

/** Creates git source config with authentication if token provided */
export function createGitSource(config: SyncConfig): SandboxSource {
  const source: SandboxSource = {
    type: 'git',
    url: `https://github.com/${config.snapshotRepo}.git`,
    revision: config.snapshotBranch,
  }

  if (config.githubToken) {
    source.username = 'x-access-token'
    source.password = config.githubToken
  }

  return source
}

/** Creates and initializes sandbox from config with specified timeout */
export async function createSandbox(
  config: SyncConfig,
  timeoutMs: number = 10 * 60 * 1000,
): Promise<Sandbox> {
  const source = createGitSource(config)

  return await Sandbox.create({
    source,
    timeout: timeoutMs,
    runtime: 'node24',
  })
}

/** Generates GitHub repo URL with token authentication if provided */
export function generateAuthRepoUrl(repoPath: string, token?: string): string {
  if (!token) {
    return `https://github.com/${repoPath}.git`
  }

  return `https://x-access-token:${token}@github.com/${repoPath}.git`
}
