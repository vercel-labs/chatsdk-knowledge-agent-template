import { z } from 'zod'

export const agentConfigSchema = z.object({
  complexity: z.enum(['trivial', 'simple', 'moderate', 'complex'])
    .describe('trivial=greeting, simple=single lookup, moderate=multi-search, complex=deep analysis'),

  maxSteps: z.number().min(1).max(30)
    .describe('Agent iterations: 3 trivial, 6 simple, 12 moderate, 20 complex'),

  model: z.enum([
    'google/gemini-3-flash',
    'google/gemini-2.5-flash-lite',
    'anthropic/claude-opus-4.5',
  ]).describe('flash-lite for trivial/simple, flash for moderate, opus for complex'),

  reasoning: z.string().max(200)
    .describe('Brief explanation of the classification'),
})

export type AgentConfig = z.infer<typeof agentConfigSchema>

export function getDefaultConfig(): AgentConfig {
  return {
    complexity: 'moderate',
    maxSteps: 12,
    model: 'google/gemini-3-flash',
    reasoning: 'Default fallback configuration',
  }
}
