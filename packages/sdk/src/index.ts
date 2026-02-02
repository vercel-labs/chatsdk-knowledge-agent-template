import { SavoirClient } from './client'
import { createBashBatchTool, createBashTool } from './tools'
import type { SavoirConfig } from './types'

export type { SavoirConfig, ShellResponse, ShellBatchResponse, ShellCommandResult, SyncOptions, SyncResponse, SnapshotResponse, GitHubSource, YouTubeSource, SourcesResponse, SyncSourceResponse, ToolCallInfo, ToolCallCallback, ToolCallState } from './types'
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
    /** Execute a single bash command in the sandbox */
    bash: ReturnType<typeof createBashTool>
    /** Execute multiple bash commands in one request (more efficient) */
    bash_batch: ReturnType<typeof createBashBatchTool>
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
 *   apiUrl: process.env.SAVOIR_API_URL!, // Required
 *   apiKey: process.env.SAVOIR_API_KEY,  // Optional if API doesn't require auth
 *   sessionId: 'optional-session-id',    // For sandbox reuse
 *   onToolCall: (info) => {              // Optional tool call callback
 *     console.log(`Tool ${info.toolName} called with:`, info.args)
 *   },
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
  const { onToolCall } = config
  const client = new SavoirClient(config)

  return {
    client,
    tools: {
      bash: createBashTool(client, onToolCall),
      bash_batch: createBashBatchTool(client, onToolCall),
    },
    getSessionId: () => client.getSessionId(),
    setSessionId: (sessionId: string) => client.setSessionId(sessionId),
  }
}
