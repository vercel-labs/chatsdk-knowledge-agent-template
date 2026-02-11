import type { UIToolInvocation } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { db } from '@nuxthub/db'
import { sql } from 'drizzle-orm'

export type RunSqlUIToolInvocation = UIToolInvocation<typeof runSqlTool>

export const runSqlTool = tool({
  description: `Execute a read-only SQL SELECT query against the application database.
Use this for custom queries when the other tools don't provide the data you need.
ONLY SELECT statements are allowed. No INSERT, UPDATE, DELETE, DROP, or ALTER.
Available tables: chats, messages, sources, agent_config, api_usage, usage_stats, user, session, account.`,
  inputSchema: z.object({
    query: z.string().describe('SQL SELECT query to execute'),
  }),
  execute: async ({ query }) => {
    const normalized = query.trim().toLowerCase()
    if (!normalized.startsWith('select')) {
      return { error: 'Only SELECT queries are allowed.' }
    }

    const blocked = ['insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate', 'replace', 'pragma']
    for (const keyword of blocked) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(query)) {
        return { error: `Query contains blocked keyword: ${keyword}` }
      }
    }

    try {
      const result = await db.run(sql.raw(query))
      return { rows: result.rows, rowCount: result.rows?.length ?? 0 }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Query failed' }
    }
  },
})
