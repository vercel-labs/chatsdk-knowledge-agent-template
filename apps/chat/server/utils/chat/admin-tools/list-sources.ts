import type { UIToolInvocation } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { desc } from 'drizzle-orm'

export type ListSourcesUIToolInvocation = UIToolInvocation<typeof listSourcesTool>

export const listSourcesTool = tool({
  description: `List all configured documentation sources (GitHub repos, YouTube channels).
Use this to check what sources are available, their sync status, and configuration.`,
  inputSchema: z.object({}),
  execute: async function* () {
    yield { status: 'loading' as const, label: 'List sources' }
    const start = Date.now()

    const sources = await db.query.sources.findMany({
      orderBy: () => desc(schema.sources.updatedAt),
    })

    yield {
      status: 'done' as const,
      label: 'List sources',
      durationMs: Date.now() - start,
      sources: sources.map(s => ({
        id: s.id,
        type: s.type,
        label: s.label,
        repo: s.repo,
        branch: s.branch,
        contentPath: s.contentPath,
        handle: s.handle,
        readmeOnly: s.readmeOnly,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    }
  },
})
