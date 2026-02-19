import type { UIToolInvocation } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import { db, schema } from '@nuxthub/db'
import { eq, isNotNull } from 'drizzle-orm'
import { preview, cmd } from './_preview'

export type ListUsersUIToolInvocation = UIToolInvocation<typeof listUsersTool>

export const listUsersTool = tool({
  description: `List application users with their usage statistics.
Use this to find active users, check who is using the app, and see per-user token consumption.`,
  inputSchema: z.object({
    limit: z.number().min(1).max(50).default(20).describe('Maximum number of users to return'),
    sortBy: z.enum(['messages', 'tokens', 'recent']).default('messages').describe('Sort users by message count, token usage, or recent activity'),
  }),
  execute: async function* ({ limit, sortBy }) {
    const label = 'List users'
    yield { status: 'loading' as const, commands: [cmd(label, '')] }
    const start = Date.now()

    const users = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        image: schema.user.image,
        role: schema.user.role,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)

    const userStats = await Promise.all(
      users.map(async (user) => {
        const userChats = await db
          .select({ id: schema.chats.id })
          .from(schema.chats)
          .where(eq(schema.chats.userId, user.id))

        if (userChats.length === 0) {
          return { ...user, messageCount: 0, totalInputTokens: 0, totalOutputTokens: 0, chatCount: 0 }
        }

        const chatIds = userChats.map(c => c.id)
        const messages = await db
          .select({
            chatId: schema.messages.chatId,
            inputTokens: schema.messages.inputTokens,
            outputTokens: schema.messages.outputTokens,
          })
          .from(schema.messages)
          .where(isNotNull(schema.messages.model))

        const userMessages = messages.filter(m => chatIds.includes(m.chatId))
        let totalInputTokens = 0
        let totalOutputTokens = 0
        for (const msg of userMessages) {
          totalInputTokens += msg.inputTokens ?? 0
          totalOutputTokens += msg.outputTokens ?? 0
        }

        return {
          ...user,
          messageCount: userMessages.length,
          totalInputTokens,
          totalOutputTokens,
          chatCount: userChats.length,
        }
      }),
    )

    if (sortBy === 'tokens') {
      userStats.sort((a, b) => (b.totalInputTokens + b.totalOutputTokens) - (a.totalInputTokens + a.totalOutputTokens))
    } else if (sortBy === 'recent') {
      userStats.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } else {
      userStats.sort((a, b) => b.messageCount - a.messageCount)
    }

    const sliced = userStats.slice(0, limit)
    const usersData = sliced.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      chatCount: u.chatCount,
      messageCount: u.messageCount,
      totalTokens: u.totalInputTokens + u.totalOutputTokens,
    }))
    yield {
      status: 'done' as const,
      commands: [cmd(label, preview(usersData))],
      durationMs: Date.now() - start,
      users: sliced.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        chatCount: u.chatCount,
        messageCount: u.messageCount,
        totalTokens: u.totalInputTokens + u.totalOutputTokens,
      })),
    }
  },
})
