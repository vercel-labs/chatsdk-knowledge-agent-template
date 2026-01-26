import { z } from 'zod'
import { useLogger } from 'evlog'
import { getOrCreateSandbox, searchAndRead } from '../../utils/sandbox/manager'

const bodySchema = z.object({
  query: z.string({ error: 'query is required - provide a search term like "useAsyncData" or "middleware"' }).min(1, 'query cannot be empty').max(500),
  limit: z.number().int().min(1).max(100).default(20),
  sessionId: z.string().optional(),
})

/**
 * POST /api/sandbox/search-and-read
 * Search for content and return matching files.
 *
 * Body:
 * - query: string - Search query (grep pattern)
 * - limit: number - Maximum results (default: 20, max: 100)
 * - sessionId: string - Optional session ID for sandbox reuse
 */
export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  requestLog.set({ query: body.query, limit: body.limit })

  // Get or create sandbox
  const sandboxStart = Date.now()
  const { sandbox, sessionId } = await getOrCreateSandbox(body.sessionId)
  const sandboxMs = Date.now() - sandboxStart

  requestLog.set({ sandboxMs, sandboxId: sandbox.sandboxId, sessionId })

  // Search and read files
  const searchStart = Date.now()
  const result = await searchAndRead(sandbox, body.query, body.limit)
  const searchMs = Date.now() - searchStart

  requestLog.set({
    searchMs,
    matchCount: result.matches.length,
    fileCount: result.files.length,
  })

  return {
    sessionId,
    matches: result.matches,
    files: result.files,
  }
})
