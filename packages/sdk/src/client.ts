import type {
  ReadResponse,
  SavoirConfig,
  SearchAndReadResponse,
} from './types'
import { NetworkError, SavoirError } from './errors'

const DEFAULT_API_URL = 'https://api.savoir.dev'

/**
 * HTTP client for the Savoir API
 */
export class SavoirClient {

  private readonly apiUrl: string
  private readonly apiKey: string
  private sessionId?: string

  constructor(config: SavoirConfig) {
    this.apiUrl = config.apiUrl?.replace(/\/$/, '') || DEFAULT_API_URL
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
   * Make a request to the API
   */
  private async request<T>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.apiUrl}${path}`

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
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
   * Search for content and return matching files
   */
  async searchAndRead(
    query: string,
    limit: number = 20,
  ): Promise<SearchAndReadResponse> {
    return await this.request<SearchAndReadResponse>('/api/sandbox/search-and-read', {
      query,
      limit,
    })
  }

  /**
   * Read specific files by path
   */
  async read(paths: string[]): Promise<ReadResponse> {
    return await this.request<ReadResponse>('/api/sandbox/read', {
      paths,
    })
  }

}
