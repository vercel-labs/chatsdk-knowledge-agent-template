/**
 * Configuration options for creating a Savoir client
 */
export interface SavoirConfig {
  /**
   * Base URL for the Savoir API
   */
  apiUrl: string

  /**
   * API key for authentication
   * Optional if the API doesn't require authentication
   */
  apiKey?: string

  /**
   * Optional session ID for sandbox reuse
   * When provided, the same sandbox will be reused for multiple requests
   */
  sessionId?: string
}

/**
 * Search result from the Savoir API
 */
export interface SearchResult {
  path: string
  lineNumber: number
  content: string
}

/**
 * File content from the Savoir API
 */
export interface FileContent {
  path: string
  content: string
}

/**
 * Response from the search-and-read endpoint
 */
export interface SearchAndReadResponse {
  sessionId: string
  matches: SearchResult[]
  files: FileContent[]
}

/**
 * Response from the read endpoint
 */
export interface ReadResponse {
  sessionId: string
  files: FileContent[]
}

/**
 * Error response from the Savoir API
 */
export interface ApiErrorResponse {
  statusCode: number
  message: string
  error?: string
}

/**
 * Options for the sync operation
 */
export interface SyncOptions {
  /** Clear all content before sync */
  reset?: boolean
  /** Push to snapshot repo after sync */
  push?: boolean
}

/**
 * Response from the sync endpoint
 */
export interface SyncResponse {
  status: 'started'
  message: string
  options: {
    reset: boolean
    push: boolean
  }
}

/**
 * Response from the snapshot endpoint
 */
export interface SnapshotResponse {
  status: 'started'
  message: string
}

/**
 * GitHub source configuration
 */
export interface GitHubSource {
  id: string
  label: string
  type: 'github'
  repo: string
  branch: string
  outputPath: string
  readmeOnly: boolean
}

/**
 * YouTube source configuration
 */
export interface YouTubeSource {
  id: string
  label: string
  type: 'youtube'
  channelId: string
  handle: string
}

/**
 * Response from the sources endpoint
 */
export interface SourcesResponse {
  total: number
  github: {
    count: number
    sources: GitHubSource[]
  }
  youtube: {
    count: number
    sources: YouTubeSource[]
  }
}

/**
 * Response from the sync source endpoint
 */
export interface SyncSourceResponse {
  status: 'started'
  message: string
  source: string
  options: {
    reset: boolean
    push: boolean
    sourceFilter: string
  }
}
