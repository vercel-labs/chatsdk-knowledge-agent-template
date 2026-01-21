import { defineHandler, readValidatedBody } from 'nitro/h3'
import { z } from 'zod'
import { getOrCreateSandbox, searchAndRead } from '~/lib/sandbox'

const bodySchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(100).default(20),
  sessionId: z.string().optional(),
})

/**
 * POST /api/sandbox/search-and-read
 * Search for content and return matching files.
 *
 * Body:
 * - query: string - Search query (ripgrep pattern)
 * - limit: number - Maximum results (default: 20, max: 100)
 * - sessionId: string - Optional session ID for sandbox reuse
 */
export default defineHandler(async (event) => {
  const body = await readValidatedBody(event, bodySchema.parse)
  const { log } = event.context

  log.set({ query: body.query, limit: body.limit, sessionId: body.sessionId })

  // Get or create sandbox
  const { sandbox, session } = await getOrCreateSandbox(body.sessionId)

  log.set({ sandboxId: sandbox.sandboxId })

  // Search and read files
  const result = await searchAndRead(sandbox, body.query, body.limit)

  log.set({
    matchCount: result.matches.length,
    fileCount: result.files.length,
  })

  return {
    sessionId: session.sandboxId.startsWith('sess_')
      ? body.sessionId
      : `sess_${session.sandboxId}`,
    matches: result.matches,
    files: result.files,
  }
})
