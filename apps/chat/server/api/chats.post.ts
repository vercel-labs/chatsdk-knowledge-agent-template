import type { UIMessage } from 'ai'
import { db, schema } from '@nuxthub/db'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const { id, mode, message } = await readValidatedBody(event, z.object({
    id: z.string(),
    mode: z.enum(['chat', 'admin']).default('chat'),
    message: z.custom<UIMessage>()
  }).parse)

  if (mode === 'admin' && user.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
  }

  const [chat] = await db.insert(schema.chats).values({
    id,
    title: '',
    mode,
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
