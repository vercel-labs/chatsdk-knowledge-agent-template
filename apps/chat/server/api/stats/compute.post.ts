import { z } from 'zod'
import { computeStats } from '../../workflows/compute-stats'

/**
 * POST /api/stats/compute
 * Trigger stats computation workflow (admin only)
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  // Body is optional - parse empty body as empty object
  const rawBody = await readBody(event) ?? {}
  const body = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).parse(rawBody)

  // Use provided date or yesterday (since today's data may be incomplete)
  const targetDate = body.date ?? (() => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().split('T')[0]!
  })()

  await computeStats({ date: targetDate })

  return {
    status: 'started',
    message: `Stats computation started for ${targetDate}`,
    date: targetDate,
  }
})
