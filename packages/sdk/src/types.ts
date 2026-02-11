export interface SavoirConfig {
  /** Base URL of your Savoir API (e.g., 'https://chat.example.com') */
  apiUrl: string
  /** API key for authentication. Create one from the admin panel (/admin/api-keys) or user settings (/settings/api-keys). */
  apiKey?: string
  /** Reuse an existing sandbox session instead of creating a new one. */
  sessionId?: string
  /** Usage source identifier (e.g. 'github-bot'). Defaults to 'sdk'. */
  source?: string
  /** Optional tracking ID (e.g. 'issue-123'). Can be overridden per reportUsage() call. */
  sourceId?: string
  /** Callback fired on tool execution (loading/done/error states). */
  onToolCall?: ToolCallCallback
}

export type ToolCallState = 'loading' | 'done' | 'error'

export interface CommandResult {
  command: string
  stdout: string
  stderr: string
  exitCode: number
  success: boolean
}

export interface ToolExecutionResult {
  commands: CommandResult[]
  success: boolean
  durationMs: number
  error?: string
}

export interface ToolCallInfo {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  state: ToolCallState
  result?: ToolExecutionResult
}

export type ToolCallCallback = (info: ToolCallInfo) => void

export interface SearchResult {
  path: string
  lineNumber: number
  content: string
}

export interface FileContent {
  path: string
  content: string
  matchCount?: number
  totalLines?: number
}

export interface SearchAndReadResponse {
  sessionId: string
  matches: SearchResult[]
  files: FileContent[]
}

export interface ReadResponse {
  sessionId: string
  files: FileContent[]
}

export interface ShellResponse {
  sessionId: string
  stdout: string
  stderr: string
  exitCode: number
}

export interface ShellCommandResult {
  command: string
  stdout: string
  stderr: string
  exitCode: number
}

export interface ShellBatchResponse {
  sessionId: string
  results: ShellCommandResult[]
}

export interface ApiErrorResponse {
  statusCode: number
  message: string
  error?: string
}

export interface SyncSource {
  id: string
  type: 'github' | 'youtube'
  label: string
  repo?: string | null
  branch?: string | null
  contentPath?: string | null
  outputPath?: string | null
  readmeOnly?: boolean | null
  channelId?: string | null
  handle?: string | null
  maxVideos?: number | null
}

export interface SyncOptions {
  /** Clear all content before sync (default: false) */
  reset?: boolean
  /** Push to snapshot repo after sync (default: true) */
  push?: boolean
  /** Sources to sync (passed from chat app DB) */
  sources?: SyncSource[]
  /** Filter to sync only a specific source by ID */
  sourceFilter?: string
}

export interface SyncResponse {
  status: 'started'
  message: string
  options: {
    reset: boolean
    push: boolean
  }
}

export interface SnapshotResponse {
  status: 'started'
  message: string
}

export interface GitHubSource {
  id: string
  label: string
  type: 'github'
  repo: string
  branch: string
  outputPath: string
  readmeOnly: boolean
}

export interface YouTubeSource {
  id: string
  label: string
  type: 'youtube'
  channelId: string
  handle: string
}

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

/** Duck-typed AI SDK generate result — works with GenerateTextResult/StreamTextResult without importing ai. */
export interface GenerateResult {
  totalUsage: { inputTokens?: number, outputTokens?: number }
  response: { modelId?: string }
}

export interface ReportUsageOptions {
  /** Override the sourceId set in config. */
  sourceId?: string
  /** Start time (Date.now()) to compute durationMs automatically. */
  startTime?: number
  /** Explicit duration in ms (takes precedence over startTime). */
  durationMs?: number
  /** Extra metadata to attach to the usage record. */
  metadata?: Record<string, unknown>
}

/** Admin-defined settings that customize agent behavior (fetched from /api/agent-config/public). */
export interface AgentConfig {
  id: string
  name: string
  additionalPrompt: string | null
  responseStyle: 'concise' | 'detailed' | 'technical' | 'friendly'
  language: string
  defaultModel: string | null
  /** Multiplier applied to router-determined maxSteps (0.5-3.0) */
  maxStepsMultiplier: number
  temperature: number
  searchInstructions: string | null
  citationFormat: 'inline' | 'footnote' | 'none'
  isActive: boolean
}
