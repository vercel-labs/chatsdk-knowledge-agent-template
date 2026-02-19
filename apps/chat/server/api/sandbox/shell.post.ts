import { z } from 'zod'
import { useLogger } from 'evlog'
import { validateShellCommand } from '@savoir/sdk'
import { getOrCreateSandbox } from '../../utils/sandbox/manager'

const bodySchema = z.object({
  command: z.string().min(1).max(2000).optional(),
  commands: z.array(z.string().min(1).max(2000)).max(10).optional(),
  sessionId: z.string().optional(),
}).refine(
  data => (data.command && !data.commands) || (!data.command && data.commands),
  { message: 'Provide either "command" or "commands", not both' },
)

const MAX_OUTPUT = 50000

function validateCommand(command: string): void {
  const validation = validateShellCommand(command, {
    allowedBaseDirectory: '/vercel/sandbox',
  })
  if (!validation.ok) {
    throw createError({
      statusCode: 400,
      message: validation.reason,
      data: { why: 'The command failed security validation', fix: 'Use only allowed commands within /vercel/sandbox' },
    })
  }
}

function truncateOutput(output: string): string {
  if (output.length > MAX_OUTPUT) {
    return `${output.slice(0, MAX_OUTPUT)}\n... (truncated, ${output.length} total chars)`
  }
  return output
}

interface CommandResult {
  command: string
  stdout: string
  stderr: string
  exitCode: number
  execMs: number
}

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const requestLog = useLogger(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  const commands = body.commands || [body.command!]

  for (const cmd of commands) {
    validateCommand(cmd)
  }

  const isBatch = commands.length > 1
  requestLog.set({ commandCount: commands.length, isBatch })

  const sandboxStart = Date.now()
  const { sandbox, sessionId } = await getOrCreateSandbox(body.sessionId)
  requestLog.set({ sandboxMs: Date.now() - sandboxStart, sandboxId: sandbox.sandboxId, sessionId })

  const results: CommandResult[] = []

  for (const command of commands) {
    const execStart = Date.now()
    const result = await sandbox.runCommand({
      cmd: 'bash',
      args: ['-c', command],
      cwd: '/vercel/sandbox',
    })

    results.push({
      command,
      stdout: truncateOutput(await result.stdout()),
      stderr: truncateOutput(await result.stderr()),
      exitCode: result.exitCode,
      execMs: Date.now() - execStart,
    })
  }

  requestLog.set({ totalExecMs: results.reduce((sum, r) => sum + r.execMs, 0), commandsExecuted: results.length })

  if (!isBatch) {
    const r = results[0]!
    return { sessionId, stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode }
  }

  return {
    sessionId,
    results: results.map(r => ({
      command: r.command,
      stdout: r.stdout,
      stderr: r.stderr,
      exitCode: r.exitCode,
    })),
  }
})
