import type { UIToolInvocation } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

export type GetAgentConfigUIToolInvocation = UIToolInvocation<typeof getAgentConfigTool>

export const getAgentConfigTool = tool({
  description: `Get the current agent configuration (system prompt customizations, response style, language, model settings).
Use this to check how the assistant is configured.`,
  inputSchema: z.object({}),
  execute: async function* () {
    yield { status: 'loading' as const, label: 'Get agent config' }
    const start = Date.now()

    const config = await db.query.agentConfig.findFirst({
      where: () => eq(schema.agentConfig.isActive, true),
    })

    if (!config) {
      yield { status: 'done' as const, label: 'Get agent config', durationMs: Date.now() - start, message: 'No active agent configuration found. Using defaults.' }
      return
    }

    yield {
      status: 'done' as const,
      label: 'Get agent config',
      durationMs: Date.now() - start,
      name: config.name,
      responseStyle: config.responseStyle,
      language: config.language,
      defaultModel: config.defaultModel,
      maxStepsMultiplier: config.maxStepsMultiplier,
      temperature: config.temperature,
      citationFormat: config.citationFormat,
      additionalPrompt: config.additionalPrompt,
      searchInstructions: config.searchInstructions,
      updatedAt: config.updatedAt,
    }
  },
})
