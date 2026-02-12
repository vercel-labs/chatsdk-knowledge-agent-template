import type { Adapter } from 'chat'

/**
 * Platform-agnostic thread context for AI enrichment.
 * Each adapter provides this via `fetchThreadContext()`.
 */
export interface ThreadContext {
  platform: string
  title: string
  body: string
  labels: string[]
  state: string
  source: string // e.g. "owner/repo" for GitHub, "workspace/channel" for Slack
  number?: number // issue/ticket number (GitHub, Linear, etc.)
  previousComments?: Array<{
    author: string
    body: string
    isBot: boolean
  }>
}

/**
 * Interface for adapters that can provide enriched context for AI.
 * Adapters that implement this can provide thread-specific context
 * beyond what the chat-sdk Thread gives us.
 */
export interface ContextProvider {
  fetchThreadContext(threadId: string): Promise<ThreadContext>
}

/**
 * Type guard to check if an adapter supports context enrichment.
 */
export function hasContextProvider(adapter: Adapter): adapter is Adapter & ContextProvider {
  return 'fetchThreadContext' in adapter && typeof (adapter as unknown as ContextProvider).fetchThreadContext === 'function'
}
