import { z } from 'zod'

export const sourceOcrItemSchema = z.object({
  type: z.enum(['github']).describe('Source type'),
  label: z.string()
    .max(50)
    .describe('Short lowercase name (e.g. "nuxt", "nuxt.com", "vue", "h3")'),
  repo: z.string()
    .max(80)
    .describe('GitHub repo in owner/repo format only (e.g. "nuxt/nuxt", "unjs/h3")')
    .optional(),
  branch: z.string()
    .max(50)
    .describe('Git branch name (e.g. "main", "v4")')
    .optional(),
  contentPath: z.string()
    .max(100)
    .describe('Folder path to docs (e.g. "docs", "docs/content")')
    .optional(),
  confidence: z.number()
    .min(0)
    .max(1)
    .describe('Confidence score: 1.0 for complete data, 0.8 for partial'),
})

export const sourceOcrSchema = z.object({
  sources: z.array(sourceOcrItemSchema),
})

export type SourceOcrItem = z.infer<typeof sourceOcrItemSchema>
export type SourceOcrResult = z.infer<typeof sourceOcrSchema>
