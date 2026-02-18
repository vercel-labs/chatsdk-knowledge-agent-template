import type { Adapter } from 'chat'
import type { ThreadContext } from '@savoir/agent'

export type { ThreadContext }

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
