import { defineHandler, readValidatedBody } from 'nitro/h3'
import { z } from 'zod'
import { getOrCreateSandbox, read } from '~/lib/sandbox'

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
export default defineHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)
  const { log } = event.context

  log.set({ pathCount: body.paths.length, sessionId: body.sessionId })

  // Get or create sandbox
  const { sandbox, session } = await getOrCreateSandbox(body.sessionId)

  log.set({ sandboxId: sandbox.sandboxId })

  // Read files
  const files = await read(sandbox, body.paths)

  log.set({ fileCount: files.length })

  return {
    sessionId: session.sandboxId.startsWith('sess_')
      ? body.sessionId
      : `sess_${session.sandboxId}`,
    files,
  }
})
