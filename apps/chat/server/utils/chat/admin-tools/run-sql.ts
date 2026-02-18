import type { UIToolInvocation } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { db } from '@nuxthub/db'
import { sql } from 'drizzle-orm'
import { cmd, preview } from './_preview'

export type RunSqlUIToolInvocation = UIToolInvocation<typeof runSqlTool>

export const runSqlTool = tool({
  description: `Execute a read-only SQL SELECT query against the PostgreSQL (PGlite) database.
Use this for custom queries when the other tools don't provide the data you need.
ONLY SELECT statements are allowed. No INSERT, UPDATE, DELETE, DROP, or ALTER.

IMPORTANT: The "timestamp" and "created_at" columns in evlog_events are TEXT (ISO 8601 strings like '2026-02-17T12:00:00.000Z'), NOT PostgreSQL timestamp types.
- Do NOT use NOW(), INTERVAL, date_trunc(), PERCENTILE_CONT(), or FILTER (WHERE ...) on these columns.
- For time filtering, compare as strings: WHERE timestamp >= '2026-02-17T00:00:00.000Z'
- For hourly grouping, use: left(timestamp, 13) as hour
- For daily grouping, use: left(timestamp, 10) as day
- The "created_at" column in chats/messages tables is a real timestamp type — those support date functions.

Available tables and their columns:
- chats (id text, title text, user_id text, mode text, is_public boolean, share_token text, created_at timestamp)
- messages (id text, chat_id text, role text, parts jsonb, feedback text, model text, input_tokens int, output_tokens int, duration_ms int, source text, created_at timestamp)
- sources (id text, type text, label text, base_path text, repo text, branch text, content_path text, output_path text, readme_only boolean, channel_id text, handle text, max_videos int, created_at timestamp, updated_at timestamp)
- agent_config (id text, name text, additional_prompt text, response_style text, language text, default_model text, max_steps_multiplier real, temperature real, search_instructions text, citation_format text, is_active boolean, created_at timestamp, updated_at timestamp)
- api_usage (id text, source text, source_id text, model text, input_tokens int, output_tokens int, duration_ms int, metadata jsonb, created_at timestamp)
- usage_stats (id text, date text, user_id text, source text, model text, message_count int, total_input_tokens int, total_output_tokens int, total_duration_ms int, created_at timestamp)
- "user" (id text, name text, email text, role text, username text, image text, created_at timestamp, updated_at timestamp)
- session, account, verification, apikey
- evlog_events (id text, timestamp TEXT, level text, service text, environment text, method text, path text, status int, duration_ms int, request_id text, source text, error jsonb, data jsonb, created_at TEXT)
Note: Use double quotes for reserved table names like "user". This is PostgreSQL via PGlite (not SQLite).`,
  inputSchema: z.object({
    query: z.string().describe('SQL SELECT query to execute'),
  }),
  execute: async function* ({ query }) {
    const q = query.trim()
    const label = q.length > 120 ? `${q.slice(0, 120)}…` : q || 'SQL query'

    yield { status: 'loading' as const, commands: [cmd(label, '')] }
    const start = Date.now()

    const normalized = q.toLowerCase()
    if (!normalized.startsWith('select')) {
      yield { status: 'done' as const, commands: [cmd(label, '', 'Only SELECT queries are allowed.', false)], durationMs: Date.now() - start, error: 'Only SELECT queries are allowed.' }
      return
    }

    const blocked = ['insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate', 'replace']
    for (const keyword of blocked) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(query)) {
        const err = `Query contains blocked keyword: ${keyword}`
        yield { status: 'done' as const, commands: [cmd(label, '', err, false)], durationMs: Date.now() - start, error: err }
        return
      }
    }

    try {
      const rawResult = await db.execute(sql.raw(query)) as unknown
      const rows: unknown[] = Array.isArray(rawResult)
        ? rawResult
        : ((rawResult as Record<string, unknown>)['rows'] as unknown[] | undefined) ?? []
      yield { status: 'done' as const, commands: [cmd(label, preview(rows.length === 1 ? rows[0] : rows.slice(0, 5)))], durationMs: Date.now() - start, rows, rowCount: rows.length }
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Query failed'
      yield { status: 'done' as const, commands: [cmd(label, '', err, false)], durationMs: Date.now() - start, error: err }
    }
  },
})
