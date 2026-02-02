import { tool } from 'ai'
import { z } from 'zod'
import type { SavoirClient } from '../client'
import type { ToolCallCallback } from '../types'

/**
 * Create the bash tool for AI SDK - runs commands in the sandbox
 */
export function createBashTool(client: SavoirClient, onToolCall?: ToolCallCallback) {
  return tool({
    description: `Execute a bash command in the documentation sandbox.
Use standard Unix commands to explore and read files.`,
    inputSchema: z.object({
      command: z.string().describe('Bash command to execute'),
    }),
    onInputAvailable: ({ toolCallId, input }) => {
      onToolCall?.({
        toolCallId,
        toolName: 'bash',
        args: input,
        state: 'loading',
      })
    },
    execute: async ({ command }, { toolCallId }) => {
      const result = await client.bash(command)

      onToolCall?.({
        toolCallId,
        toolName: 'bash',
        args: { command },
        state: 'done',
      })

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      }
    },
  })
}
