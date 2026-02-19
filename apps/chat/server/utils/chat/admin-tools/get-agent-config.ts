import type { UIToolInvocation } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { preview, cmd } from './_preview'

export type GetAgentConfigUIToolInvocation = UIToolInvocation<typeof getAgentConfigTool>

export const getAgentConfigTool = tool({
  description: `Get the current agent configuration (system prompt customizations, response style, language, model settings).
Use this to check how the assistant is configured.`,
  inputSchema: z.object({}),
  execute: async function* () {
    const label = 'Get agent config'
    yield { status: 'loading' as const, commands: [cmd(label, '')] }
    const start = Date.now()

    const config = await db.query.agentConfig.findFirst({
      where: () => eq(schema.agentConfig.isActive, true),
    })

    if (!config) {
      yield { status: 'done' as const, commands: [cmd(label, 'No active configuration')], durationMs: Date.now() - start, message: 'No active agent configuration found. Using defaults.' }
      return
    }

    const configData = { name: config.name, responseStyle: config.responseStyle, language: config.language, defaultModel: config.defaultModel, temperature: config.temperature }
    yield {
      status: 'done' as const,
      commands: [cmd(label, preview(configData))],
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
