import { z } from 'zod'
import { useLogger } from 'evlog'
import { getOrCreateSandbox, read } from '../../utils/sandbox/manager'

const bodySchema = z.object({
  paths: z.array(z.string().min(1)).min(1).max(50),
  sessionId: z.string().optional(),
})

/**
 * POST /api/sandbox/read
 * Read specific files by path.
 *
 * Body:
 * - paths: string[] - File paths to read (max: 50)
 * - sessionId: string - Optional session ID for sandbox reuse
 */
export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  requestLog.set({ pathCount: body.paths.length })

  // Get or create sandbox
  const sandboxStart = Date.now()
  const { sandbox, sessionId } = await getOrCreateSandbox(body.sessionId)
  const sandboxMs = Date.now() - sandboxStart

  requestLog.set({ sandboxMs, sandboxId: sandbox.sandboxId, sessionId })

  // Read files
  const readStart = Date.now()
  const files = await read(sandbox, body.paths)
  const readMs = Date.now() - readStart

  requestLog.set({ readMs, fileCount: files.length })

  return {
    sessionId,
    files,
  }
})
