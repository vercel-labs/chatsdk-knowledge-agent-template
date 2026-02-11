import type { UIToolInvocation } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { desc, eq, and, sql } from 'drizzle-orm'

export type QueryChatsUIToolInvocation = UIToolInvocation<typeof queryChatsTool>

export const queryChatsTool = tool({
  description: `Query recent chats to understand what users are asking about.
Use this to find popular topics, identify common questions, or debug user issues.`,
  inputSchema: z.object({
    limit: z.number().min(1).max(50).default(20).describe('Number of recent chats to return'),
    userId: z.string().optional().describe('Filter chats by a specific user ID'),
  }),
  execute: async ({ limit, userId }) => {
    const conditions = userId
      ? and(eq(schema.chats.userId, userId))
      : undefined

    const chats = await db.query.chats.findMany({
      where: () => conditions ?? sql`1=1`,
      orderBy: () => desc(schema.chats.createdAt),
      limit,
      with: {
        messages: {
          limit: 1,
          orderBy: () => schema.messages.createdAt,
        },
      },
    })

    return chats.map(c => ({
      id: c.id,
      title: c.title,
      mode: c.mode,
      userId: c.userId,
      createdAt: c.createdAt,
      messageCount: c.messages?.length ?? 0,
      firstMessage: c.messages?.[0]?.parts
        ? JSON.stringify(c.messages[0].parts).slice(0, 200)
        : null,
    }))
  },
})
