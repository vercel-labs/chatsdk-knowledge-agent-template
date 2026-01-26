import { generateText, Output } from 'ai'
import { z } from 'zod'

const bodySchema = z.object({
  images: z.array(z.string()).optional().default([]),
  configs: z.array(z.object({
    filename: z.string(),
    content: z.string(),
  })).optional().default([]),
})

const systemPrompt = `Extract ALL documentation source configurations from the provided content.

For each source found, extract:

**GitHub repositories:**
- repo: owner/repo format (e.g. "nuxt/nuxt", "unjs/h3")
- branch: the git branch (default "main" if not specified)
- contentPath: the folder path containing documentation files (e.g. "docs", "docs/content", "content/docs")
- label: derive from the label field if present, otherwise from repo name (e.g. "Nuxt" from nuxt/nuxt)

**YouTube channels:**
- channelId: starts with "UC" (e.g. "UCxxxxxx")
- handle: the @handle format (e.g. "@TheAlexLichter")
- label: the channel name

Return ALL sources found. Set confidence to 1.0 for clearly defined sources, 0.8 for sources with some missing fields.`

async function extractFromImage(image: string) {
  const { output } = await generateText({
    model: 'google/gemini-3-flash',
    output: Output.object({ schema: sourceOcrSchema }),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: systemPrompt },
          { type: 'image', image },
        ],
      },
    ],
  })
  return output?.sources || []
}

async function extractFromConfig(config: { filename: string, content: string }) {
  const { output } = await generateText({
    model: 'google/gemini-2.5-flash-lite',
    output: Output.object({ schema: sourceOcrSchema }),
    messages: [
      {
        role: 'user',
        content: `${systemPrompt}\n\n--- File: ${config.filename} ---\n${config.content}\n--- End of ${config.filename} ---`,
      },
    ],
  })
  return output?.sources || []
}

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const { images, configs } = await readValidatedBody(event, bodySchema.parse)

  if (images.length === 0 && configs.length === 0) {
    return { sources: [] }
  }

  const results = await Promise.all([
    ...images.map(extractFromImage),
    ...configs.map(extractFromConfig),
  ])

  const allSources = results.flat()

  const seen = new Set<string>()
  const uniqueSources = allSources.filter((source) => {
    const key = source.type === 'github'
      ? source.repo?.toLowerCase()
      : source.channelId?.toLowerCase()

    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { sources: uniqueSources }
})
