import { z } from 'zod'

export const ROUTER_MODEL = 'google/gemini-2.5-flash-lite'
export const DEFAULT_MODEL = 'google/gemini-3-flash'

export const agentConfigSchema = z.object({
  complexity: z.enum(['trivial', 'simple', 'moderate', 'complex'])
    .describe('trivial=greeting, simple=single lookup, moderate=multi-search, complex=deep analysis'),

  maxSteps: z.number().min(1).max(30)
    .describe('Agent iterations: 4 trivial, 8 simple, 15 moderate, 25 complex'),

  model: z.enum([
    'google/gemini-3-flash',
    'anthropic/claude-sonnet-4.5',
    'anthropic/claude-opus-4.6',
  ]).describe('flash for trivial/simple, sonnet for moderate, opus for complex'),

  reasoning: z.string().max(200)
    .describe('Brief explanation of the classification'),
})

export type AgentConfig = z.infer<typeof agentConfigSchema>

export function getDefaultConfig(): AgentConfig {
  return {
    complexity: 'moderate',
    maxSteps: 15,
    model: 'anthropic/claude-sonnet-4.5',
    reasoning: 'Default fallback configuration',
  }
}
