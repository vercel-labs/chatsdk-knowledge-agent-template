import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { invalidateAgentConfigCache } from '../../utils/agent-config'

const bodySchema = z.object({
  additionalPrompt: z.string().nullable().optional(),
  responseStyle: z.enum(['concise', 'detailed', 'technical', 'friendly']).optional(),
  language: z.string().optional(),
  defaultModel: z.string().nullable().optional(),
  maxStepsMultiplier: z.number().min(0.5).max(3.0).optional(),
  temperature: z.number().min(0).max(2).optional(),
  searchInstructions: z.string().nullable().optional(),
  citationFormat: z.enum(['inline', 'footnote', 'none']).optional(),
})

/**
 * PUT /api/agent-config
 * Update the active agent configuration (admin only)
 */
export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  await requireAdmin(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  requestLog.set({ fieldsChanged: Object.keys(body) })

  const existing = await db.query.agentConfig.findFirst({
    where: () => eq(schema.agentConfig.isActive, true),
  })

  let config

  if (existing) {
    const [updated] = await db.update(schema.agentConfig)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(schema.agentConfig.id, existing.id))
      .returning()
    config = updated
  } else {
    const [created] = await db.insert(schema.agentConfig)
      .values({
        id: crypto.randomUUID(),
        name: 'default',
        additionalPrompt: body.additionalPrompt ?? null,
        responseStyle: body.responseStyle ?? 'concise',
        language: body.language ?? 'en',
        defaultModel: body.defaultModel ?? null,
        maxStepsMultiplier: body.maxStepsMultiplier ?? 1.0,
        temperature: body.temperature ?? 0.7,
        searchInstructions: body.searchInstructions ?? null,
        citationFormat: body.citationFormat ?? 'inline',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()
    config = created
  }

  invalidateAgentConfigCache()

  requestLog.set({ configId: config?.id })

  return config
})
