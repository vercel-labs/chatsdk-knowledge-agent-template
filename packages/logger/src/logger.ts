import type { EnvironmentContext, Logger, LoggerConfig, RequestLogger, WideEvent } from './types'

let globalLogger: Logger | null = null

/**
 * Format duration in human-readable format
 * - < 1s: shows milliseconds (e.g., "42ms")
 * - >= 1s: shows seconds (e.g., "1.5s")
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Create the application logger (singleton)
 *
 * @example
 * ```ts
 * const logger = createLogger({
 *   env: {
 *     service: 'api',
 *     environment: process.env.NODE_ENV ?? 'development',
 *   },
 * })
 *
 * // Simple workflow-style logs
 * logger.log('workflow', 'Syncing nuxt-icon...')
 * logger.log('workflow', 'nuxt-icon: 1 files in 31ms')
 *
 * // Wide event for request logging
 * const log = logger.request({ method: 'POST', path: '/checkout' })
 * log.set({ user: { id: '123' } })
 * log.emit()
 * ```
 */
export function createLogger(config: LoggerConfig): Logger {
  if (globalLogger) {
    return globalLogger
  }

  const { env, pretty = process.env.NODE_ENV !== 'production' } = config

  function formatEvent(level: 'info' | 'error', event: Record<string, unknown>): WideEvent {
    return {
      timestamp: new Date().toISOString(),
      level,
      service: env.service,
      environment: env.environment,
      ...(env.commitHash && { commitHash: env.commitHash }),
      ...(env.version && { version: env.version }),
      ...(env.region && { region: env.region }),
      ...event,
    }
  }

  function emitWideEvent(level: 'info' | 'error', event: Record<string, unknown>): void {
    const formatted = formatEvent(level, event)

    if (pretty) {
      const { timestamp, level: lvl, service, ...rest } = formatted
      const color = lvl === 'error' ? '\x1b[31m' : '\x1b[36m'
      const reset = '\x1b[0m'
      const dim = '\x1b[2m'

      console[lvl === 'error' ? 'error' : 'log'](
        `${dim}${timestamp}${reset} ${color}[${service}]${reset}`,
        JSON.stringify(rest, null, 2),
      )
    }
    else {
      console[level === 'error' ? 'error' : 'log'](JSON.stringify(formatted))
    }
  }

  /**
   * Simple log output: [tag] message
   * For workflow-style progress messages
   */
  function log(tag: string, message: string): void {
    const cyan = '\x1b[36m'
    const reset = '\x1b[0m'

    if (pretty) {
      console.log(`${cyan}[${tag}]${reset} ${message}`)
    }
    else {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: env.service,
        tag,
        message,
      }))
    }
  }

  function createRequestLogger(initialContext: Record<string, unknown> = {}): RequestLogger {
    const startTime = performance.now()
    let context: Record<string, unknown> = { ...initialContext }
    let errorInfo: Record<string, unknown> | null = null

    return {
      set<T extends Record<string, unknown>>(newContext: T): void {
        context = { ...context, ...newContext }
      },

      error(error: Error | string, extraContext?: Record<string, unknown>): void {
        if (error instanceof Error) {
          errorInfo = {
            message: error.message,
            name: error.name,
            ...(error.stack && { stack: error.stack }),
            ...extraContext,
          }
        }
        else {
          errorInfo = { message: error, ...extraContext }
        }
      },

      emit(overrides?: Record<string, unknown>): void {
        const durationMs = performance.now() - startTime
        const level = errorInfo ? 'error' : 'info'

        emitWideEvent(level, {
          ...context,
          ...(errorInfo && { error: errorInfo }),
          ...overrides,
          duration: formatDuration(durationMs),
          durationMs: Math.round(durationMs * 100) / 100,
        })
      },

      getContext(): Record<string, unknown> {
        return { ...context }
      },
    }
  }

  globalLogger = {
    log,

    info(event: Record<string, unknown>): void {
      emitWideEvent('info', event)
    },

    error(event: Record<string, unknown>): void {
      emitWideEvent('error', event)
    },

    request: createRequestLogger,

    get env(): EnvironmentContext {
      return env
    },
  }

  return globalLogger
}

/**
 * Get the global logger instance
 * Auto-initializes with defaults if not already initialized
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    createLogger({
      env: {
        service: process.env.SERVICE_NAME ?? 'app',
        environment: process.env.NODE_ENV ?? 'development',
        commitHash: process.env.COMMIT_SHA,
        version: process.env.npm_package_version,
      },
    })
  }
  return globalLogger!
}

/**
 * Reset the global logger (useful for testing)
 */
export function resetLogger(): void {
  globalLogger = null
}
