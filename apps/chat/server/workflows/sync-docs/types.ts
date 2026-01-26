/**
 * Types for sync-docs workflow
 */

export interface SyncConfig {
  githubToken?: string
  snapshotRepo: string
  snapshotBranch: string
}

export interface GitHubSource {
  id: string
  type: 'github'
  label: string
  basePath: string
  repo: string
  branch: string
  contentPath: string
  outputPath: string
  readmeOnly: boolean
}

export interface SyncSourceResult {
  sourceId: string
  label: string
  success: boolean
  fileCount: number
  error?: string
}

export interface SyncResult {
  success: boolean
  snapshotId?: string
  summary: {
    total: number
    success: number
    failed: number
    files: number
  }
  results: SyncSourceResult[]
}
