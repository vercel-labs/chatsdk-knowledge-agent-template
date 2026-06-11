import { tool } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { desc } from 'drizzle-orm'
import { preview, cmd } from './_preview'

export const listSourcesTool = tool({
  description: `List all configured documentation sources (GitHub repos, file uploads).
Use this to check what sources are available, their sync status, and configuration.`,
  inputSchema: z.object({}),
  execute: async function* () {
    const label = 'List sources'
    yield { status: 'loading' as const, commands: [cmd(label, '')] }
    const start = Date.now()

    const sources = await db.query.sources.findMany({
      orderBy: () => desc(schema.sources.updatedAt),
    })

    const sourcesData = sources.map(s => ({ id: s.id, type: s.type, label: s.label, repo: s.repo }))
    yield {
      status: 'done' as const,
      commands: [cmd(label, preview(sourcesData))],
      durationMs: Date.now() - start,
      sources: sources.map(s => ({
        id: s.id,
        type: s.type,
        label: s.label,
        repo: s.repo,
        branch: s.branch,
        contentPath: s.contentPath,
        readmeOnly: s.readmeOnly,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    }
  },
})
