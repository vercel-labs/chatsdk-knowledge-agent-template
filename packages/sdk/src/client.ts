import { createError } from 'evlog'
import type {
  SavoirConfig,
  ShellResponse,
  SnapshotResponse,
  SourcesResponse,
  SyncOptions,
  SyncResponse,
  SyncSourceResponse,
} from './types'
import { NetworkError, SavoirError } from './errors'

/**
 * HTTP client for the Savoir API
 */
export class SavoirClient {

  private readonly apiUrl: string
  private readonly apiKey?: string
  private sessionId?: string

  constructor(config: SavoirConfig) {
    if (!config.apiUrl) {
      throw createError({
        message: 'Missing apiUrl in Savoir configuration',
        why: 'The Savoir SDK requires an API URL to connect to',
        fix: 'Set SAVOIR_API_URL environment variable or pass apiUrl to createSavoir()',
      })
    }

    this.apiUrl = config.apiUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
    this.sessionId = config.sessionId
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId
  }

  /**
   * Set the session ID for subsequent requests
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId
  }

  /**
   * Make a GET request to the API
   */
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

  /**
   * Make a POST request to the API
   */
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

  /**
   * Run a bash command in the sandbox
   */
  async bash(command: string): Promise<ShellResponse> {
    return await this.post<ShellResponse>('/api/sandbox/shell', {
      command,
    })
  }

  /**
   * Get list of configured sources
   */
  async getSources(): Promise<SourcesResponse> {
    return await this.get<SourcesResponse>('/api/sources')
  }

  /**
   * Trigger documentation sync workflow for all sources
   */
  async sync(options?: SyncOptions): Promise<SyncResponse> {
    return await this.post<SyncResponse>('/api/sync', {
      reset: options?.reset ?? false,
      push: options?.push ?? true,
      sources: options?.sources,
      sourceFilter: options?.sourceFilter,
    })
  }

  /**
   * Trigger documentation sync workflow for a specific source
   */
  async syncSource(sourceId: string, options?: SyncOptions): Promise<SyncSourceResponse> {
    return await this.post<SyncSourceResponse>(`/api/sync/${sourceId}`, {
      reset: options?.reset ?? false,
      push: options?.push ?? true,
    })
  }

  /**
   * Trigger snapshot creation workflow
   */
  async createSnapshot(): Promise<SnapshotResponse> {
    return await this.post<SnapshotResponse>('/api/sandbox/snapshot', {})
  }

}
