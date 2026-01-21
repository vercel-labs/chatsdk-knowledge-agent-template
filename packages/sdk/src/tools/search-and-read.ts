import { tool } from 'ai'
import { z } from 'zod'
import type { SavoirClient } from '../client'

/**
 * Create the searchAndRead tool for AI SDK
 */
export function createSearchAndReadTool(client: SavoirClient) {
  return tool({
    description: `Search the documentation for content matching a query and return the full file contents.
Use this tool to find relevant documentation about a topic.
Returns both the matching lines with context and the complete file contents for deeper understanding.`,
    parameters: z.object({
      query: z.string().describe('The search query (supports regex patterns)'),
      limit: z.number().int().min(1).max(100).default(20).describe('Maximum number of results to return'),
    }),
    execute: async ({ query, limit }) => {
      const result = await client.searchAndRead(query, limit)

      return {
        matchCount: result.matches.length,
        fileCount: result.files.length,
        matches: result.matches.map(m => ({
          path: m.path,
          line: m.lineNumber,
          content: m.content,
        })),
        files: result.files.map(f => ({
          path: f.path,
          content: f.content,
        })),
      }
    },
  })
}
