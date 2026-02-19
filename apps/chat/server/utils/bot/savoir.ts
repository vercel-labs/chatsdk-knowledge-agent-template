import { tool } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { createError } from 'evlog'
import type { GenerateResult, ReportUsageOptions } from '@savoir/sdk'
import { getOrCreateSandbox } from '../sandbox/manager'
import { getAgentConfig, type AgentConfigData } from '../agent-config'

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
      throw createError({
        message: 'Command blocked by security policy',
        status: 403,
        why: `Command contains blocked pattern: ${command.slice(0, 50)}`,
      })
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
}

export interface InternalSavoir {
  tools: {
    bash: ReturnType<typeof createInternalBashTool>
    bash_batch: ReturnType<typeof createInternalBashBatchTool>
  }
  getAgentConfig: () => Promise<AgentConfigData>
  reportUsage: (result: GenerateResult, options?: ReportUsageOptions) => Promise<void>
}

function createInternalBashTool() {
  let sessionId: string | undefined

  return tool({
    description: `Execute a bash command in the documentation sandbox.
Use standard Unix commands to explore and read files.`,
    inputSchema: z.object({
      command: z.string().describe('Bash command to execute'),
    }),
    execute: async function* ({ command }) {
      yield { status: 'loading' as const }
      const start = Date.now()

      validateCommand(command)

      const active = await getOrCreateSandbox(sessionId)
      ;({ sessionId } = active)

      const result = await active.sandbox.runCommand({
        cmd: 'bash',
        args: ['-c', command],
        cwd: '/vercel/sandbox',
      })

      const stdout = truncateOutput(await result.stdout())
      const stderr = truncateOutput(await result.stderr())
      const durationMs = Date.now() - start
      const success = result.exitCode === 0

      yield {
        status: 'done' as const,
        success,
        durationMs,
        stdout,
        stderr,
        exitCode: result.exitCode,
        commands: [{ command, stdout, stderr, exitCode: result.exitCode, success }],
      }
    },
  })
}

function createInternalBashBatchTool() {
  let sessionId: string | undefined

  return tool({
    description: `Execute multiple bash commands in the documentation sandbox in a single request.
More efficient than multiple single bash calls — use this as your primary tool.
Combine search (grep) and read (head/cat) commands in a single batch.
Maximum 10 commands per batch.`,
    inputSchema: z.object({
      commands: z.array(z.string()).min(1).max(10).describe('Array of bash commands to execute'),
    }),
    execute: async function* ({ commands }) {
      yield { status: 'loading' as const }
      const start = Date.now()

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

      const durationMs = Date.now() - start

      yield {
        status: 'done' as const,
        success: results.every(r => r.success),
        durationMs,
        results: results.map(r => ({ command: r.command, stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode })),
        commands: results,
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
  const { source, sourceId } = config

  return {
    tools: {
      bash: createInternalBashTool(),
      bash_batch: createInternalBashBatchTool(),
    },
    getAgentConfig,
    reportUsage: (result, options) => reportUsageInternal(source || 'bot', sourceId, result, options),
  }
}
