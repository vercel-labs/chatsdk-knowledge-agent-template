import { tool } from 'ai'
import { z } from 'zod'
import type { SavoirClient } from '../client'
import type { ToolCallCallback } from '../types'

/**
 * Create the searchAndRead tool for AI SDK
 */
export function createSearchAndReadTool(client: SavoirClient, onToolCall?: ToolCallCallback) {
  return tool({
    description: `Search the documentation for content matching a query and return the full file contents.
Use this tool to find relevant documentation about a topic.
Returns both the matching lines with context and the complete file contents for deeper understanding.`,
    inputSchema: z.object({
      query: z.string().describe('The search query (supports regex patterns)'),
      limit: z.number().int().min(1).max(100).default(20).describe('Maximum number of results to return'),
    }),
    onInputAvailable: ({ toolCallId, input }) => {
      onToolCall?.({
        toolCallId,
        toolName: 'search_and_read',
        args: input,
        state: 'loading',
      })
    },
    execute: async ({ query, limit }, { toolCallId }) => {
      const result = await client.searchAndRead(query, limit)

      onToolCall?.({
        toolCallId,
        toolName: 'search_and_read',
        args: { query, limit },
        state: 'done',
      })

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
