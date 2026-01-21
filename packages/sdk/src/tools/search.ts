import { tool } from 'ai'
import { z } from 'zod'
import type { SavoirClient } from '../client'

/**
 * Create the search tool for AI SDK
 */
export function createSearchTool(client: SavoirClient) {
  return tool({
    description: `Search the documentation for content matching a query.
Use this tool to find file paths and line numbers that match a search pattern.
Returns the matching lines with their file paths and line numbers.
For full file contents, use the read tool after finding relevant files.`,
    parameters: z.object({
      query: z.string().describe('The search query (supports regex patterns)'),
      limit: z.number().int().min(1).max(100).default(20).describe('Maximum number of results to return'),
    }),
    execute: async ({ query, limit }) => {
      const result = await client.search(query, limit)

      return {
        matchCount: result.matches.length,
        matches: result.matches.map(m => ({
          path: m.path,
          line: m.lineNumber,
          content: m.content,
        })),
      }
    },
  })
}
