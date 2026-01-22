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
