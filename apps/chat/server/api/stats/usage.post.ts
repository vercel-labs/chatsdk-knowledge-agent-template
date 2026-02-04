import { z } from 'zod'
import { db, schema } from '@nuxthub/db'

const usageSchema = z.object({
  source: z.string().min(1).max(50), // 'github-bot', 'discord-bot', 'sdk', etc.
  sourceId: z.string().nullish(), // Issue number, PR number, etc.
  model: z.string().nullish(),
  inputTokens: z.number().int().nonnegative().nullish(),
  outputTokens: z.number().int().nonnegative().nullish(),
  durationMs: z.number().int().nonnegative().nullish(),
  metadata: z.record(z.string(), z.unknown()).nullish(), // Additional context
})

/**
 * POST /api/stats/usage
 * Record API usage from external sources (SDK, GitHub bot, etc.)
 *
 * @example
 * ```ts
 * await $fetch('/api/stats/usage', {
 *   method: 'POST',
 *   body: {
 *     source: 'github-bot',
 *     sourceId: 'issue-123',
 *     model: 'google/gemini-3-flash',
 *     inputTokens: 1000,
 *     outputTokens: 500,
 *     durationMs: 2500,
 *     metadata: { repo: 'owner/repo', user: 'username' }
 *   }
 * })
 * ```
 */
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, usageSchema.parse)

  const usage = await db.insert(schema.apiUsage).values({
    source: body.source,
    sourceId: body.sourceId ?? undefined,
    model: body.model ?? undefined,
    inputTokens: body.inputTokens ?? undefined,
    outputTokens: body.outputTokens ?? undefined,
    durationMs: body.durationMs ?? undefined,
    metadata: body.metadata ?? undefined,
  }).returning()

  return {
    id: usage[0]?.id,
    recorded: true,
  }
})
