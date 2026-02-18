import { z } from 'zod'

export const callOptionsSchema = z.object({
  model: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})
