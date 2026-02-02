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

  /**
   * Optional callback when a tool call is made
   * Called with tool call info when input is available
   */
  onToolCall?: ToolCallCallback
}

/**
 * Tool call state
 */
export type ToolCallState = 'loading' | 'done'

/**
 * Tool call information passed to onToolCall callback
 */
export interface ToolCallInfo {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  state: ToolCallState
}

/**
 * Callback type for tool call notifications
 */
export type ToolCallCallback = (info: ToolCallInfo) => void

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
 * When from search-and-read, contains context snippets around matches
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
 * Response from the shell endpoint (single command)
 */
export interface ShellResponse {
  sessionId: string
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Single command result in batch response
 */
export interface ShellCommandResult {
  command: string
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Response from the shell endpoint (batch commands)
 */
export interface ShellBatchResponse {
  sessionId: string
  results: ShellCommandResult[]
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
 * Source passed for sync
 */
export interface SyncSource {
  id: string
  type: 'github' | 'youtube'
  label: string
  // GitHub fields
  repo?: string | null
  branch?: string | null
  contentPath?: string | null
  outputPath?: string | null
  readmeOnly?: boolean | null
  // YouTube fields
  channelId?: string | null
  handle?: string | null
  maxVideos?: number | null
}

/**
 * Options for the sync operation
 */
export interface SyncOptions {
  /** Clear all content before sync */
  reset?: boolean
  /** Push to snapshot repo after sync */
  push?: boolean
  /** Sources to sync (passed from chat app DB) */
  sources?: SyncSource[]
  /** Filter to sync only specific source */
  sourceFilter?: string
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
