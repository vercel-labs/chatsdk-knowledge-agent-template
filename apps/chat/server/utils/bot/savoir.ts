import { tool } from 'ai'
import { z } from 'zod'
import { getOrCreateSandbox } from '../sandbox/manager'
import { getAgentConfig, type AgentConfigData } from '../agent-config'
import { db, schema } from '@nuxthub/db'
import type { ToolCallCallback, ToolCallInfo, GenerateResult, ReportUsageOptions } from '@savoir/sdk'

const BLOCKED_PATTERNS = [
  /\brm\s+-rf?\b/i,
  /\brmdir\b/i,
  /\bmkdir\b/i,
  /\btouch\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bsudo\b/i,
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bnc\b/i,
  /\bssh\b/i,
  /\bgit\b/i,
  />\s*\//,
  /\bdd\b/i,
  /\bkill\b/i,
  /\bpkill\b/i,
]

const MAX_OUTPUT = 50000

function validateCommand(command: string): void {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(`Command contains blocked pattern: ${command.slice(0, 50)}`)
    }
  }
}

function truncateOutput(output: string): string {
  if (output.length > MAX_OUTPUT) {
    return `${output.slice(0, MAX_OUTPUT)}\n... (truncated, ${output.length} total chars)`
  }
  return output
}

interface InternalSavoirConfig {
  source?: string
  sourceId?: string
  onToolCall?: ToolCallCallback
}

export interface InternalSavoir {
  tools: {
    bash: ReturnType<typeof createInternalBashTool>
    bash_batch: ReturnType<typeof createInternalBashBatchTool>
  }
  getAgentConfig: () => Promise<AgentConfigData>
  reportUsage: (result: GenerateResult, options?: ReportUsageOptions) => Promise<void>
}

function createInternalBashTool(onToolCall?: ToolCallCallback) {
  let sessionId: string | undefined

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
      validateCommand(command)
      const startTime = Date.now()

      try {
        const active = await getOrCreateSandbox(sessionId)
        ;({ sessionId } = active)

        const result = await active.sandbox.runCommand({
          cmd: 'bash',
          args: ['-c', command],
          cwd: '/vercel/sandbox',
        })

        const stdout = truncateOutput(await result.stdout())
        const stderr = truncateOutput(await result.stderr())
        const durationMs = Date.now() - startTime

        onToolCall?.({
          toolCallId,
          toolName: 'bash',
          args: { command },
          state: 'done',
          result: {
            commands: [{ command, stdout, stderr, exitCode: result.exitCode, success: result.exitCode === 0 }],
            success: result.exitCode === 0,
            durationMs,
          },
        })

        return { stdout, stderr, exitCode: result.exitCode }
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

function createInternalBashBatchTool(onToolCall?: ToolCallCallback) {
  let sessionId: string | undefined

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
      const startTime = Date.now()

      try {
        for (const cmd of commands) validateCommand(cmd)

        const active = await getOrCreateSandbox(sessionId)
        ;({ sessionId } = active)

        const results = []
        for (const command of commands) {
          const result = await active.sandbox.runCommand({
            cmd: 'bash',
            args: ['-c', command],
            cwd: '/vercel/sandbox',
          })

          results.push({
            command,
            stdout: truncateOutput(await result.stdout()),
            stderr: truncateOutput(await result.stderr()),
            exitCode: result.exitCode,
            success: result.exitCode === 0,
          })
        }

        const durationMs = Date.now() - startTime

        onToolCall?.({
          toolCallId,
          toolName: 'bash_batch',
          args: { commands },
          state: 'done',
          result: {
            commands: results,
            success: results.every(r => r.success),
            durationMs,
          },
        })

        return {
          results: results.map(r => ({
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

async function reportUsageInternal(
  source: string,
  sourceId: string | undefined,
  result: GenerateResult,
  options?: ReportUsageOptions,
): Promise<void> {
  const durationMs = options?.durationMs ?? (options?.startTime ? Date.now() - options.startTime : undefined)

  await db.insert(schema.apiUsage).values({
    source,
    sourceId: options?.sourceId ?? sourceId,
    model: result.response.modelId ?? undefined,
    inputTokens: result.totalUsage.inputTokens ?? undefined,
    outputTokens: result.totalUsage.outputTokens ?? undefined,
    durationMs,
    metadata: options?.metadata ?? undefined,
  })
}

export function createInternalSavoir(config: InternalSavoirConfig = {}): InternalSavoir {
  const { onToolCall, source, sourceId } = config

  return {
    tools: {
      bash: createInternalBashTool(onToolCall),
      bash_batch: createInternalBashBatchTool(onToolCall),
    },
    getAgentConfig,
    reportUsage: (result, options) => reportUsageInternal(source || 'bot', sourceId, result, options),
  }
}
