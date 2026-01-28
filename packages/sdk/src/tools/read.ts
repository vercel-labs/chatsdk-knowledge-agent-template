import { tool } from 'ai'
import { z } from 'zod'
import type { SavoirClient } from '../client'
import type { ToolCallCallback } from '../types'

/**
 * Create the read tool for AI SDK
 */
export function createReadTool(client: SavoirClient, onToolCall?: ToolCallCallback) {
  return tool({
    description: `Read specific documentation files by their paths.
Use this tool when you know the exact file paths you want to read.
Returns the full content of each requested file.`,
    inputSchema: z.object({
      paths: z.array(z.string()).min(1).max(50).describe('Array of file paths to read'),
    }),
    onInputAvailable: ({ toolCallId, input }) => {
      onToolCall?.({
        toolCallId,
        toolName: 'read',
        args: input,
        state: 'loading',
      })
    },
    execute: async ({ paths }, { toolCallId }) => {
      const result = await client.read(paths)

      onToolCall?.({
        toolCallId,
        toolName: 'read',
        args: { paths },
        state: 'done',
      })

      return {
        fileCount: result.files.length,
        files: result.files.map(f => ({
          path: f.path,
          content: f.content,
        })),
      }
    },
  })
}
