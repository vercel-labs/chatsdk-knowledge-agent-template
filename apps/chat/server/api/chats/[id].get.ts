import { db, schema } from '@nuxthub/db'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'

const paramsSchema = z.object({
  id: z.string().min(1, 'Missing chat ID'),
})

export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  const { user } = await requireUserSession(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  requestLog.set({ chatId: id })

  const chat = await db.query.chats.findFirst({
    where: () => and(
      eq(schema.chats.id, id),
      eq(schema.chats.userId, user.id)
    ),
    with: {
      messages: {
        orderBy: () => asc(schema.messages.createdAt)
      }
    }
  })

  if (!chat) {
    throw createError({ statusCode: 404, statusMessage: 'Chat not found', data: { why: 'No chat exists with this ID for your user account', fix: 'Verify the chat ID is correct' } })
  }

  requestLog.set({ messageCount: chat.messages.length })

  return chat
})
