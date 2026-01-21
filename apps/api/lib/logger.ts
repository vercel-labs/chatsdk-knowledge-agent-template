import { createLogger, getLogger } from '@savoir/logger'

/**
 * Initialize the API logger
 * Call this once at application startup
 */
export function initLogger() {
  return createLogger({
    env: {
      service: 'api',
      environment: process.env.NODE_ENV ?? 'development',
      commitHash: process.env.COMMIT_SHA,
      version: '0.1.0',
    },
  })
}

export { getLogger }
