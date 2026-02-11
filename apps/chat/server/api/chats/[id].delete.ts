import { blob } from 'hub:blob'
import { db, schema } from '@nuxthub/db'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const paramsSchema = z.object({
  id: z.string().min(1, 'Missing chat ID'),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  const chat = await db.query.chats.findFirst({
    where: () => and(eq(schema.chats.id, id), eq(schema.chats.userId, user.id))
  })

  if (!chat) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Chat not found'
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
            console.error('[delete-chat] Failed to delete file:', b.pathname, error)
          )
        )
      )
    }
  } catch (error) {
    console.error('Failed to list/delete chat files:', error)
  }

  return await db.delete(schema.chats)
    .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, user.id)))
    .returning()
})
