/**
 * Types for create-snapshot workflow
 */

export interface SnapshotConfig {
  githubToken?: string
  snapshotRepo: string
  snapshotBranch: string
}

export interface SnapshotResult {
  success: boolean
  snapshotId?: string
  sourceRepo?: string
  error?: string
}
