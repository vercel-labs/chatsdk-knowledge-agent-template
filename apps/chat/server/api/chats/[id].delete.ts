import { blob } from 'hub:blob'
import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const paramsSchema = z.object({
  id: z.string().min(1, 'Missing chat ID'),
})

export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  const { user } = await requireUserSession(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  requestLog.set({ chat: { id }, user: { id: user.id } })

  const chat = await db.query.chats.findFirst({
    where: () => and(eq(schema.chats.id, id), eq(schema.chats.userId, user.id))
  })

  if (!chat) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Chat not found',
      data: { why: 'No chat exists with this ID for your user account', fix: 'Verify the chat ID is correct' },
    })
  }

  const chatFolder = `${user.username}/${id}`

  try {
    const { blobs } = await blob.list({
      prefix: chatFolder
    })

    if (blobs.length > 0) {
      await Promise.all(
        blobs.map(b =>
          blob.del(b.pathname).catch(error =>
            log.warn({ event: 'chat.delete.file_failed', pathname: b.pathname, error: error instanceof Error ? error.message : 'Unknown' })
          )
        )
      )
    }
  } catch (error) {
    log.warn({ event: 'chat.delete.blob_cleanup_failed', chatId: id, error: error instanceof Error ? error.message : 'Unknown' })
  }

  return await db.delete(schema.chats)
    .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, user.id)))
    .returning()
})
