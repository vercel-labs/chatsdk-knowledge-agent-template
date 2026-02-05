import type { ApiErrorResponse } from './types'

export class SavoirError extends Error {

  readonly statusCode: number
  readonly error?: string

  constructor(response: ApiErrorResponse) {
    super(response.message)
    this.name = 'SavoirError'
    this.statusCode = response.statusCode
    this.error = response.error
  }

  isAuthError(): boolean {
    return this.statusCode === 401
  }

  isRateLimitError(): boolean {
    return this.statusCode === 429
  }

  isServerError(): boolean {
    return this.statusCode >= 500
  }

}

export class NetworkError extends Error {

  readonly cause?: Error

  constructor(message: string, cause?: Error) {
    super(message)
    this.name = 'NetworkError'
    this.cause = cause
  }

}
