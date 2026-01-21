import { z } from 'zod'

const AdditionalSyncSchema = z.object({
  repo: z.string().min(1),
  branch: z.string().optional(),
  contentPath: z.string().optional(),
})

const GitHubSourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'Must be in format owner/repo'),
  branch: z.string().optional(),
  contentPath: z.string().optional(),
  outputPath: z.string().optional(),
  readmeOnly: z.boolean().optional(),
  additionalSyncs: z.array(AdditionalSyncSchema).optional(),
})

const YouTubeSourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  channelId: z.string().min(1),
  handle: z.string().optional(),
  maxVideos: z.number().int().positive().optional(),
})

const CustomSourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  fetchFn: z.any(),
})

const SavoirConfigSchema = z.object({
  sources: z.object({
    github: z.array(GitHubSourceSchema).optional(),
    youtube: z.array(YouTubeSourceSchema).optional(),
    custom: z.array(CustomSourceSchema).optional(),
  }).optional(),
})

export type ValidatedConfig = z.infer<typeof SavoirConfigSchema>

export function validateConfig(config: unknown): ValidatedConfig {
  return SavoirConfigSchema.parse(config)
}
