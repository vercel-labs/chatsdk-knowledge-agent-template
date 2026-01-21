import type { ApiErrorResponse } from './types'

/**
 * Error class for Savoir API errors
 */
export class SavoirError extends Error {

  readonly statusCode: number
  readonly error?: string

  constructor(response: ApiErrorResponse) {
    super(response.message)
    this.name = 'SavoirError'
    this.statusCode = response.statusCode
    this.error = response.error
  }

  /**
   * Check if the error is due to invalid authentication
   */
  isAuthError(): boolean {
    return this.statusCode === 401
  }

  /**
   * Check if the error is due to rate limiting
   */
  isRateLimitError(): boolean {
    return this.statusCode === 429
  }

  /**
   * Check if the error is a server error
   */
  isServerError(): boolean {
    return this.statusCode >= 500
  }

}

/**
 * Error class for network-related errors
 */
export class NetworkError extends Error {

  readonly cause?: Error

  constructor(message: string, cause?: Error) {
    super(message)
    this.name = 'NetworkError'
    this.cause = cause
  }

}
