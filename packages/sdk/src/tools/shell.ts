import { tool } from 'ai'
import { z } from 'zod'
import type { SavoirClient } from '../client'
import type { ToolCallCallback, ToolExecutionResult, CommandResult } from '../types'

export function createBashTool(client: SavoirClient, onToolCall?: ToolCallCallback) {
  return tool({
    description: `Execute a bash command in the documentation sandbox.
Use standard Unix commands to explore and read files.`,
    inputSchema: z.object({
      command: z.string().describe('Bash command to execute'),
    }),
    inputExamples: [
      { input: { command: 'find docs/ -maxdepth 2 -type d' } },
      { input: { command: 'grep -rl "useAsyncData" docs/ --include="*.md" | head -5' } },
    ],
    onInputAvailable: ({ toolCallId, input }) => {
      onToolCall?.({
        toolCallId,
        toolName: 'bash',
        args: input,
        state: 'loading',
      })
    },
    execute: async ({ command }, { toolCallId }) => {
      const startTime = Date.now()

      try {
        const apiResult = await client.bash(command)
        const durationMs = Date.now() - startTime

        const commandResult: CommandResult = {
          command,
          stdout: apiResult.stdout,
          stderr: apiResult.stderr,
          exitCode: apiResult.exitCode,
          success: apiResult.exitCode === 0,
        }

        const executionResult: ToolExecutionResult = {
          commands: [commandResult],
          success: commandResult.success,
          durationMs,
        }

        onToolCall?.({
          toolCallId,
          toolName: 'bash',
          args: { command },
          state: 'done',
          result: executionResult,
        })

        return {
          stdout: apiResult.stdout,
          stderr: apiResult.stderr,
          exitCode: apiResult.exitCode,
        }
      } catch (error) {
        const durationMs = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        onToolCall?.({
          toolCallId,
          toolName: 'bash',
          args: { command },
          state: 'error',
          result: {
            commands: [{ command, stdout: '', stderr: errorMessage, exitCode: 1, success: false }],
            success: false,
            durationMs,
            error: errorMessage,
          },
        })

        throw error
      }
    },
  })
}

export function createBashBatchTool(client: SavoirClient, onToolCall?: ToolCallCallback) {
  return tool({
    description: `Execute multiple bash commands in the documentation sandbox in a single request.
More efficient than multiple single bash calls — use this as your primary tool.
Combine search (grep) and read (head/cat) commands in a single batch.
Maximum 10 commands per batch.`,
    inputSchema: z.object({
      commands: z.array(z.string()).min(1).max(10).describe('Array of bash commands to execute'),
    }),
    inputExamples: [
      { input: { commands: [
        'grep -rl "useAsyncData" docs/ --include="*.md" | head -5',
        'head -80 docs/nuxt/1.getting-started/1.introduction.md',
      ] } },
      { input: { commands: [
        'grep -rl "routing" docs/nuxt/ --include="*.md" | head -5',
        'grep -rl "routing" docs/nitro/ --include="*.md" | head -5',
        'head -80 docs/nuxt/1.getting-started/3.routing.md',
      ] } },
    ],
    onInputAvailable: ({ toolCallId, input }) => {
      onToolCall?.({
        toolCallId,
        toolName: 'bash_batch',
        args: input,
        state: 'loading',
      })
    },
    execute: async ({ commands }, { toolCallId }) => {
      const startTime = Date.now()

      try {
        const apiResult = await client.bashBatch(commands)
        const durationMs = Date.now() - startTime

        const commandResults: CommandResult[] = apiResult.results.map(r => ({
          command: r.command,
          stdout: r.stdout,
          stderr: r.stderr,
          exitCode: r.exitCode,
          success: r.exitCode === 0,
        }))

        const executionResult: ToolExecutionResult = {
          commands: commandResults,
          success: commandResults.every(r => r.success),
          durationMs,
        }

        onToolCall?.({
          toolCallId,
          toolName: 'bash_batch',
          args: { commands },
          state: 'done',
          result: executionResult,
        })

        return {
          results: apiResult.results.map(r => ({
            command: r.command,
            stdout: r.stdout,
            stderr: r.stderr,
            exitCode: r.exitCode,
          })),
        }
      } catch (error) {
        const durationMs = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        onToolCall?.({
          toolCallId,
          toolName: 'bash_batch',
          args: { commands },
          state: 'error',
          result: {
            commands: commands.map(cmd => ({ command: cmd, stdout: '', stderr: '', exitCode: 1, success: false })),
            success: false,
            durationMs,
            error: errorMessage,
          },
        })

        throw error
      }
    },
  })
}
