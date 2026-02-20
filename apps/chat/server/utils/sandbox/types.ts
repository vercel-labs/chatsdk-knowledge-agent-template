import type { Sandbox } from '@vercel/sandbox'

export interface SandboxSession {
  sandboxId: string
  snapshotId: string
  createdAt: number
  lastAccessedAt: number
  expiresAt: number
}

export interface SnapshotMetadata {
  snapshotId: string
  createdAt: number
  sourceRepo: string
  commitSha?: string
}

export interface SandboxManagerConfig {
  githubToken?: string
  snapshotRepo: string
  snapshotBranch?: string
  sessionTtlMs?: number
}

export interface ActiveSandbox {
  sandbox: Sandbox
  session: SandboxSession
  sessionId: string
}

export const KV_KEYS = {
  CURRENT_SNAPSHOT: 'snapshot:current',
  SNAPSHOT_STATUS_CACHE: 'snapshot:status-cache',
  SNAPSHOT_REPO_CONFIG: 'snapshot:repo-config',
  LAST_SOURCE_SYNC: 'sources:last-sync',
  AGENT_CONFIG_CACHE: 'agent:config-cache',
  session: (sessionId: string) => `session:${sessionId}`,
  ACTIVE_SANDBOX_SESSION: 'sandbox:active-session',
} as const
