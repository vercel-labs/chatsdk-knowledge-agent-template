/**
 * Environment context automatically included in every log event
 */
export interface EnvironmentContext {
  /** Service name (e.g., 'api', 'worker') */
  service: string
  /** Environment (e.g., 'production', 'staging', 'development') */
  environment: string
  /** Git commit hash for deployment tracking */
  commitHash?: string
  /** Service version */
  version?: string
  /** Region/datacenter identifier */
  region?: string
}

/**
 * Configuration options for the logger
 */
export interface LoggerConfig {
  /** Environment context included in all events */
  env: EnvironmentContext
  /** Enable pretty printing for development (default: based on NODE_ENV) */
  pretty?: boolean
}

/**
 * Base fields for all wide events
 */
export interface BaseWideEvent {
  /** ISO timestamp */
  timestamp: string
  /** Log level */
  level: 'info' | 'error'
  /** Service name */
  service: string
  /** Environment */
  environment: string
  /** Commit hash */
  commitHash?: string
  /** Service version */
  version?: string
  /** Region */
  region?: string
}

/**
 * A wide event with arbitrary additional context
 */
export type WideEvent = BaseWideEvent & Record<string, unknown>

/**
 * Context builder for accumulating wide event data
 */
export interface WideEventBuilder {
  /** Add context to the wide event */
  set: <T extends Record<string, unknown>>(context: T) => void
  /** Get current accumulated context */
  getContext: () => Record<string, unknown>
  /** Emit the wide event (called automatically in finally block) */
  emit: (level?: 'info' | 'error') => void
}

/**
 * Request-scoped logger for building wide events
 */
export interface RequestLogger {
  /** Add context to the current request's wide event */
  set: <T extends Record<string, unknown>>(context: T) => void
  /** Log an error (will be included in the wide event) */
  error: (error: Error | string, context?: Record<string, unknown>) => void
  /** Manually emit the wide event (usually done by middleware) */
  emit: (overrides?: Record<string, unknown>) => void
  /** Get the accumulated context */
  getContext: () => Record<string, unknown>
}

/**
 * Main logger interface - single instance per application
 */
export interface Logger {
  /** Simple log: [tag] message - for workflow-style progress logs */
  log: (tag: string, message: string) => void
  /** Log an info-level wide event */
  info: (event: Record<string, unknown>) => void
  /** Log an error-level wide event */
  error: (event: Record<string, unknown>) => void
  /** Create a request-scoped logger for building a wide event */
  request: (initialContext?: Record<string, unknown>) => RequestLogger
  /** Get environment context */
  readonly env: EnvironmentContext
}
