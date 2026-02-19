import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'

/**
 * Returns provider-native search tools for the given model.
 * These are provider-defined tools executed server-side by the provider.
 */
export function getSearchTools(modelId: string): Record<string, unknown> {
  const [provider] = modelId.split('/')

  switch (provider) {
    case 'anthropic':
      return { web_search: anthropic.tools.webSearch_20250305() }
    case 'google':
      return { google_search: google.tools.googleSearch({}) }
    default:
      return {}
  }
}
