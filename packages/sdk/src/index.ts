import { SavoirClient } from './client'
import { createBashBatchTool, createBashTool } from './tools'
import type { AgentConfig, GenerateResult, ReportUsageOptions, SavoirConfig } from './types'

export type { SavoirConfig, ShellResponse, ShellBatchResponse, ShellCommandResult, SyncOptions, SyncResponse, SnapshotResponse, GitHubSource, YouTubeSource, SourcesResponse, SyncSourceResponse, ToolCallInfo, ToolCallCallback, ToolCallState, ToolExecutionResult, CommandResult, AgentConfig, GenerateResult, ReportUsageOptions } from './types'
export { SavoirError, NetworkError } from './errors'
export { SavoirClient } from './client'

export interface Savoir {
  /** Low-level HTTP client for direct API access */
  client: SavoirClient
  /** AI SDK tools for use with generateText/streamText */
  tools: {
    bash: ReturnType<typeof createBashTool>
    /** Runs multiple commands in one request (more efficient, sandbox is reused) */
    bash_batch: ReturnType<typeof createBashBatchTool>
  }
  getSessionId: () => string | undefined
  setSessionId: (sessionId: string) => void
  /** Fetch admin-defined agent customization settings */
  getAgentConfig: () => Promise<AgentConfig>
  /** Report usage from an AI SDK generate result. Extracts totalUsage and modelId automatically. */
  reportUsage: (result: GenerateResult, options?: ReportUsageOptions) => Promise<void>
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
    getAgentConfig: () => client.getAgentConfig(),
    reportUsage: (result, options) => client.reportUsage(result, options),
  }
}
