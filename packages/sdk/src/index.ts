import { SavoirClient } from './client'
import { createReadTool, createSearchAndReadTool } from './tools'
import type { SavoirConfig } from './types'

export type { SavoirConfig, SearchResult, FileContent, SearchAndReadResponse, ReadResponse } from './types'
export { SavoirError, NetworkError } from './errors'
export { SavoirClient } from './client'

/**
 * Savoir instance with client and AI SDK tools
 */
export interface Savoir {
  /**
   * HTTP client for direct API access
   */
  client: SavoirClient

  /**
   * AI SDK tools
   */
  tools: {
    search_and_read: ReturnType<typeof createSearchAndReadTool>
    read: ReturnType<typeof createReadTool>
  }

  /**
   * Get the current session ID
   */
  getSessionId: () => string | undefined

  /**
   * Set the session ID for subsequent requests
   */
  setSessionId: (sessionId: string) => void
}

/**
 * Create a Savoir instance with API client and AI SDK tools
 *
 * @example
 * ```ts
 * import { createSavoir } from '@savoir/sdk'
 * import { generateText } from 'ai'
 *
 * const savoir = createSavoir({
 *   apiKey: process.env.SAVOIR_API_KEY!,
 *   sessionId: 'optional-session-id', // For sandbox reuse
 * })
 *
 * const { text } = await generateText({
 *   model: 'google/gemini-3-flash',
 *   tools: savoir.tools,
 *   prompt: 'How to use useAsyncData in Nuxt?',
 * })
 * ```
 */
export function createSavoir(config: SavoirConfig): Savoir {
  const client = new SavoirClient(config)

  return {
    client,
    tools: {
      search_and_read: createSearchAndReadTool(client),
      read: createReadTool(client),
    },
    getSessionId: () => client.getSessionId(),
    setSessionId: (sessionId: string) => client.setSessionId(sessionId),
  }
}
