/**
 * Input types for configuration (what users write in savoir.config.ts)
 */

export interface GitHubSourceInput {
  id: string
  label?: string
  repo: string
  branch?: string
  contentPath?: string
  outputPath?: string
  readmeOnly?: boolean
  additionalSyncs?: Array<{
    repo: string
    branch?: string
    contentPath?: string
  }>
}

export interface YouTubeSourceInput {
  id: string
  label?: string
  channelId: string
  handle?: string
  maxVideos?: number
}

export interface CustomSourceInput {
  id: string
  label?: string
  fetchFn: () => Promise<ContentFile[]>
}

export interface SavoirConfigInput {
  sources?: {
    github?: GitHubSourceInput[]
    youtube?: YouTubeSourceInput[]
    custom?: CustomSourceInput[]
  }
}

/**
 * Normalized types (after defaults are applied)
 */

interface BaseSource {
  id: string
  label: string
  type: 'github' | 'youtube' | 'custom'
}

export interface GitHubSource extends BaseSource {
  type: 'github'
  repo: string
  branch: string
  contentPath: string
  outputPath: string
  readmeOnly: boolean
  additionalSyncs: Array<{
    repo: string
    branch: string
    contentPath: string
  }>
}

export interface YouTubeSource extends BaseSource {
  type: 'youtube'
  channelId: string
  handle?: string
  maxVideos: number
}

export interface CustomSource extends BaseSource {
  type: 'custom'
  fetchFn: () => Promise<ContentFile[]>
}

export type Source = GitHubSource | YouTubeSource | CustomSource

export interface ContentFile {
  path: string
  content: string
}

/**
 * Loaded config result
 */
export interface LoadedConfig {
  config: SavoirConfigInput
  sources: Source[]
  github: GitHubSource[]
  youtube: YouTubeSource[]
  custom: CustomSource[]
}

/**
 * Sync-related types (re-exported for convenience)
 */
export interface SyncResult {
  sourceId: string
  success: boolean
  fileCount?: number
  error?: string
  duration?: number
}

export interface SyncConfig {
  githubToken: string
  snapshotRepo: string
  snapshotBranch: string
}

export interface SyncOptions {
  reset?: boolean
  push?: boolean
  sourceFilter?: string
}

export interface PushResult {
  success: boolean
  commitSha?: string
  filesChanged?: number
  error?: string
}

export interface SnapshotConfig {
  repo: string
  branch: string
  token: string
  commitMessage?: string
}
