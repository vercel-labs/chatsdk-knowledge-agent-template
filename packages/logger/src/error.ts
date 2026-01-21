export interface ErrorOptions {
  /** What actually happened */
  message: string
  /** Why this error occurred */
  why?: string
  /** How to fix this issue */
  fix?: string
  /** Link to documentation or more information */
  link?: string
  /** The original error that caused this */
  cause?: Error
}

/**
 * Structured error with context for better debugging
 *
 * @example
 * ```ts
 * throw new SavoirError({
 *   message: 'Failed to sync repository',
 *   why: 'GitHub API rate limit exceeded',
 *   fix: 'Wait 1 hour or use a different token',
 *   link: 'https://docs.github.com/en/rest/rate-limit',
 *   cause: originalError,
 * })
 * ```
 */
export class SavoirError extends Error {
  readonly why?: string
  readonly fix?: string
  readonly link?: string

  constructor(options: ErrorOptions | string) {
    const opts = typeof options === 'string' ? { message: options } : options

    super(opts.message, { cause: opts.cause })

    this.name = 'SavoirError'
    this.why = opts.why
    this.fix = opts.fix
    this.link = opts.link

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SavoirError)
    }
  }

  /**
   * Format error for console output with colors
   */
  toString(): string {
    const red = '\x1b[31m'
    const yellow = '\x1b[33m'
    const cyan = '\x1b[36m'
    const dim = '\x1b[2m'
    const reset = '\x1b[0m'
    const bold = '\x1b[1m'

    const lines: string[] = []

    lines.push(`${red}${bold}Error:${reset} ${this.message}`)

    if (this.why) {
      lines.push(`${yellow}Why:${reset} ${this.why}`)
    }

    if (this.fix) {
      lines.push(`${cyan}Fix:${reset} ${this.fix}`)
    }

    if (this.link) {
      lines.push(`${dim}More info:${reset} ${this.link}`)
    }

    if (this.cause) {
      lines.push(`${dim}Caused by:${reset} ${(this.cause as Error).message}`)
    }

    return lines.join('\n')
  }

  /**
   * Convert to plain object for JSON serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      why: this.why,
      fix: this.fix,
      link: this.link,
      cause: this.cause instanceof Error
        ? { name: this.cause.name, message: this.cause.message }
        : undefined,
      stack: this.stack,
    }
  }
}

/**
 * Create a SavoirError (functional alternative to `new SavoirError()`)
 */
export function createError(options: ErrorOptions | string): SavoirError {
  return new SavoirError(options)
}
