import { z } from 'zod'
import { useLogger } from 'evlog'
import { getOrCreateSandbox } from '../../utils/sandbox/manager'

const bodySchema = z.object({
  command: z.string({ error: 'command is required' }).min(1, 'command cannot be empty').max(2000),
  sessionId: z.string().optional(),
})

// Commands that could be dangerous
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
  />\s*\//, // redirect to absolute path
  /\bdd\b/i,
  /\bkill\b/i,
  /\bpkill\b/i,
]

/**
 * POST /api/sandbox/shell
 * Run a shell command in the sandbox.
 *
 * Body:
 * - command: string - Shell command to execute
 * - sessionId: string - Optional session ID for sandbox reuse
 */
export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  // Check for blocked patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(body.command)) {
      throw createError({
        statusCode: 400,
        message: 'Command contains blocked pattern',
      })
    }
  }

  requestLog.set({ command: body.command.slice(0, 100) })

  // Get or create sandbox
  const sandboxStart = Date.now()
  const { sandbox, sessionId } = await getOrCreateSandbox(body.sessionId)
  const sandboxMs = Date.now() - sandboxStart

  requestLog.set({ sandboxMs, sandboxId: sandbox.sandboxId, sessionId })

  // Execute command
  const execStart = Date.now()
  const result = await sandbox.runCommand({
    cmd: 'bash',
    args: ['-c', body.command],
    cwd: '/vercel/sandbox',
  })

  const stdout = await result.stdout()
  const stderr = await result.stderr()
  const { exitCode } = result
  const execMs = Date.now() - execStart

  // Limit output size to prevent token explosion
  const MAX_OUTPUT = 50000 // ~50KB
  const truncatedStdout = stdout.length > MAX_OUTPUT
    ? `${stdout.slice(0, MAX_OUTPUT)}\n... (truncated, ${stdout.length} total chars)`
    : stdout
  const truncatedStderr = stderr.length > MAX_OUTPUT
    ? `${stderr.slice(0, MAX_OUTPUT)}\n... (truncated, ${stderr.length} total chars)`
    : stderr

  requestLog.set({
    execMs,
    exitCode,
    stdoutLen: stdout.length,
    stderrLen: stderr.length,
  })

  return {
    sessionId,
    stdout: truncatedStdout,
    stderr: truncatedStderr,
    exitCode,
  }
})
