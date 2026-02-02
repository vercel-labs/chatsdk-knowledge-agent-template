import { tool } from 'ai'
import { z } from 'zod'
import type { SavoirClient } from '../client'
import type { ToolCallCallback } from '../types'

/**
 * Create the bash tool for AI SDK - runs a single command in the sandbox
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

/**
 * Create the bash_batch tool for AI SDK - runs multiple commands in one API call
 */
export function createBashBatchTool(client: SavoirClient, onToolCall?: ToolCallCallback) {
  return tool({
    description: `Execute multiple bash commands in the documentation sandbox in a single request.
More efficient than multiple single bash calls. Commands run sequentially.
Use when you need to run several related commands (e.g., list + read multiple files).
Maximum 10 commands per batch.`,
    inputSchema: z.object({
      commands: z.array(z.string()).min(1).max(10).describe('Array of bash commands to execute'),
    }),
    onInputAvailable: ({ toolCallId, input }) => {
      onToolCall?.({
        toolCallId,
        toolName: 'bash_batch',
        args: input,
        state: 'loading',
      })
    },
    execute: async ({ commands }, { toolCallId }) => {
      const result = await client.bashBatch(commands)

      onToolCall?.({
        toolCallId,
        toolName: 'bash_batch',
        args: { commands },
        state: 'done',
      })

      return {
        results: result.results.map(r => ({
          command: r.command,
          stdout: r.stdout,
          stderr: r.stderr,
          exitCode: r.exitCode,
        })),
      }
    },
  })
}
