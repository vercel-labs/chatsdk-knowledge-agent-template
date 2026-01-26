import { z } from 'zod'

export const sourceOcrItemSchema = z.object({
  type: z.enum(['github', 'youtube']),
  label: z.string(),
  repo: z.string().optional(),
  branch: z.string().optional(),
  contentPath: z.string().optional(),
  channelId: z.string().optional(),
  handle: z.string().optional(),
  confidence: z.number().min(0).max(1),
})

export const sourceOcrSchema = z.object({
  sources: z.array(sourceOcrItemSchema),
})

export type SourceOcrItem = z.infer<typeof sourceOcrItemSchema>
export type SourceOcrResult = z.infer<typeof sourceOcrSchema>
