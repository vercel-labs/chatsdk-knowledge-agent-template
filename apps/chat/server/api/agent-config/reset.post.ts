import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { invalidateAgentConfigCache, getDefaultAgentConfig } from '../../utils/agent-config'

/**
 * POST /api/agent-config/reset
 * Reset agent configuration to defaults (admin only)
 */
export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  await requireAdmin(event)

  const defaults = getDefaultAgentConfig()

  const existing = await db.query.agentConfig.findFirst({
    where: () => eq(schema.agentConfig.isActive, true),
  })

  let config

  if (existing) {
    const [updated] = await db.update(schema.agentConfig)
      .set({
        additionalPrompt: null,
        responseStyle: defaults.responseStyle,
        language: defaults.language,
        defaultModel: null,
        maxStepsMultiplier: defaults.maxStepsMultiplier,
        temperature: defaults.temperature,
        searchInstructions: null,
        citationFormat: defaults.citationFormat,
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
        additionalPrompt: null,
        responseStyle: defaults.responseStyle,
        language: defaults.language,
        defaultModel: null,
        maxStepsMultiplier: defaults.maxStepsMultiplier,
        temperature: defaults.temperature,
        searchInstructions: null,
        citationFormat: defaults.citationFormat,
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
