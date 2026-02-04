import type {
  AgentConfig,
  SavoirConfig,
  ShellBatchResponse,
  ShellResponse,
  SnapshotResponse,
  SourcesResponse,
  SyncOptions,
  SyncResponse,
  SyncSourceResponse,
} from './types'
import { NetworkError, SavoirError } from './errors'

/** Low-level HTTP client for the Savoir API. Use `createSavoir()` for the high-level interface with AI SDK tools. */
export class SavoirClient {

  private readonly apiUrl: string
  private readonly apiKey?: string
  private sessionId?: string

  constructor(config: SavoirConfig) {
    if (!config.apiUrl) {
      throw new Error(
        'Missing apiUrl in Savoir configuration. ' +
        'Set SAVOIR_API_URL environment variable or pass apiUrl to createSavoir()',
      )
    }

    this.apiUrl = config.apiUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
    this.sessionId = config.sessionId
  }

  getSessionId(): string | undefined {
    return this.sessionId
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.apiUrl}${path}`

    const headers: Record<string, string> = {}

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    try {
      const response = await fetch(url, { method: 'GET', headers })
      const data = await response.json()

      if (!response.ok) {
        throw new SavoirError({
          statusCode: response.status,
          message: data.message || 'Unknown error',
          error: data.error,
        })
      }

      return data as T
    } catch (error) {
      if (error instanceof SavoirError) {
        throw error
      }

      throw new NetworkError(
        `Failed to connect to Savoir API: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  private async post<T>(
    path: string,
    body: Record<string, unknown> = {},
  ): Promise<T> {
    const url = `${this.apiUrl}${path}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...body,
          sessionId: this.sessionId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new SavoirError({
          statusCode: response.status,
          message: data.message || 'Unknown error',
          error: data.error,
        })
      }

      // Update session ID from response
      if (data.sessionId) {
        this.sessionId = data.sessionId
      }

      return data as T
    } catch (error) {
      if (error instanceof SavoirError) {
        throw error
      }

      throw new NetworkError(
        `Failed to connect to Savoir API: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
      )
    }
  }

  async bash(command: string): Promise<ShellResponse> {
    return await this.post<ShellResponse>('/api/sandbox/shell', {
      command,
    })
  }

  /** More efficient than multiple single calls as sandbox is reused */
  async bashBatch(commands: string[]): Promise<ShellBatchResponse> {
    return await this.post<ShellBatchResponse>('/api/sandbox/shell', {
      commands,
    })
  }

  async getSources(): Promise<SourcesResponse> {
    return await this.get<SourcesResponse>('/api/sources')
  }

  async sync(options?: SyncOptions): Promise<SyncResponse> {
    return await this.post<SyncResponse>('/api/sync', {
      reset: options?.reset ?? false,
      push: options?.push ?? true,
      sources: options?.sources,
      sourceFilter: options?.sourceFilter,
    })
  }

  async syncSource(sourceId: string, options?: SyncOptions): Promise<SyncSourceResponse> {
    return await this.post<SyncSourceResponse>(`/api/sync/${sourceId}`, {
      reset: options?.reset ?? false,
      push: options?.push ?? true,
    })
  }

  async createSnapshot(): Promise<SnapshotResponse> {
    return await this.post<SnapshotResponse>('/api/sandbox/snapshot', {})
  }

  async getAgentConfig(): Promise<AgentConfig> {
    return await this.get<AgentConfig>('/api/agent-config/public')
  }

}
