import type { UIMessage } from 'ai'
import { db, schema } from '@nuxthub/db'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const { id, message } = await readValidatedBody(event, z.object({
    id: z.string(),
    message: z.custom<UIMessage>()
  }).parse)

  const [chat] = await db.insert(schema.chats).values({
    id,
    title: '',
    userId: user.id
  }).returning()

  if (!chat) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create chat' })
  }

  await db.insert(schema.messages).values({
    id: message.id,
    chatId: chat.id,
    role: 'user',
    parts: message.parts
  })

  return chat
})
