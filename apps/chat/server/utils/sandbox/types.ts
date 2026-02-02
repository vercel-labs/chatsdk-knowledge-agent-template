import type { Sandbox } from '@vercel/sandbox'

/**
 * Sandbox session stored in KV
 */
export interface SandboxSession {
  sandboxId: string
  snapshotId: string
  createdAt: number
  lastAccessedAt: number
  expiresAt: number
}

/**
 * Snapshot metadata stored in KV
 */
export interface SnapshotMetadata {
  snapshotId: string
  createdAt: number
  sourceRepo: string
  commitSha?: string
}

/**
 * Search result from grep
 */
export interface SearchResult {
  path: string
  lineNumber: number
  content: string
}

/**
 * File content with path and optional metadata
 */
export interface FileContent {
  path: string
  content: string
  /** Number of matches in this file (for context snippets) */
  matchCount?: number
  /** Total lines in the file (for context snippets) */
  totalLines?: number
}

/**
 * Search and read combined result
 */
export interface SearchAndReadResult {
  matches: SearchResult[]
  files: FileContent[]
}

/**
 * Sandbox manager configuration
 * Uses Vercel OIDC token automatically.
 */
export interface SandboxManagerConfig {
  // GitHub authentication for private repos
  githubToken?: string
  // Snapshot repository configuration
  snapshotRepo: string
  snapshotBranch?: string
  sessionTtlMs?: number
}

/**
 * Active sandbox instance with metadata
 */
export interface ActiveSandbox {
  sandbox: Sandbox
  session: SandboxSession
  sessionId: string
}

/**
 * KV storage keys
 */
export const KV_KEYS = {
  CURRENT_SNAPSHOT: 'snapshot:current',
  SNAPSHOT_STATUS_CACHE: 'snapshot:status-cache',
  LAST_SOURCE_SYNC: 'sources:last-sync',
  session: (sessionId: string) => `session:${sessionId}`,
} as const
