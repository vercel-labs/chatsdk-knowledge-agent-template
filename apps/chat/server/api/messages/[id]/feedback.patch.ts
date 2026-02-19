import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const paramsSchema = z.object({
  id: z.string().min(1, 'Missing message ID'),
})

export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  const { user } = await requireUserSession(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const { feedback } = await readValidatedBody(event, z.object({
    feedback: z.enum(['positive', 'negative']).nullable()
  }).parse)

  requestLog.set({ userId: user.id, messageId: id, feedback })

  // Find the message and verify it belongs to the user's chat
  const message = await db.query.messages.findFirst({
    where: () => eq(schema.messages.id, id),
    with: {
      chat: true
    }
  })

  if (!message) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Message not found',
      data: { why: 'No message exists with this ID', fix: 'Verify the message ID is correct' },
    })
  }

  if (message.chat.userId !== user.id) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      data: { why: 'This message belongs to another user\'s chat', fix: 'You can only provide feedback on messages in your own chats' },
    })
  }

  // Only allow feedback on assistant messages
  if (message.role !== 'assistant') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Feedback can only be added to assistant messages',
      data: { why: 'User messages cannot receive feedback', fix: 'Select an assistant message to provide feedback on' },
    })
  }

  const [updated] = await db.update(schema.messages)
    .set({ feedback })
    .where(eq(schema.messages.id, id))
    .returning()

  return updated
})
