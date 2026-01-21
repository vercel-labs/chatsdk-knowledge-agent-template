import { defineMiddleware, getRequestURL, type H3Event } from 'nitro/h3'
import { getLogger, type RequestLogger } from '@savoir/logger'

declare module 'nitro/h3' {
  interface H3EventContext {
    log: RequestLogger
  }
}

/** Paths to exclude from automatic logging (internal/health endpoints) */
const EXCLUDED_PATHS = [
  '/.well-known/',
  '/health',
  '/favicon.ico',
]

function getHttpMethod(event: H3Event): string {
  return (event as unknown as { method?: string }).method ?? 'GET'
}

function shouldLog(pathname: string): boolean {
  return !EXCLUDED_PATHS.some(excluded => pathname.startsWith(excluded))
}

/**
 * Request logging middleware
 * Creates a wide event logger for each request
 * Only emits logs for API endpoints (excludes internal workflow paths)
 */
export default defineMiddleware(async (event, next) => {
  const url = getRequestURL(event)
  const logger = getLogger()
  const shouldEmit = shouldLog(url.pathname)

  // Create request-scoped logger with initial context
  const log = logger.request({
    method: getHttpMethod(event),
    path: url.pathname,
    requestId: crypto.randomUUID(),
  })

  // Attach to event context for use in handlers
  event.context.log = log

  try {
    const response = await next()

    log.set({
      statusCode: 200,
      outcome: 'success',
    })

    return response
  }
  catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500

    log.error(error as Error)
    log.set({
      statusCode,
      outcome: 'error',
    })

    throw error
  }
  finally {
    // Only emit logs for non-excluded paths, or always emit on errors
    if (shouldEmit || log.getContext().outcome === 'error') {
      log.emit()
    }
  }
})
