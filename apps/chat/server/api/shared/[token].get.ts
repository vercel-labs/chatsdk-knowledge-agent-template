import { db, schema } from '@nuxthub/db'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'

const paramsSchema = z.object({
  token: z.string().min(1, 'Missing share token'),
})

export default defineCachedEventHandler(
  async (event) => {
    const { token } = await getValidatedRouterParams(event, paramsSchema.parse)

    const chat = await db.query.chats.findFirst({
      where: () => and(
        eq(schema.chats.shareToken, token),
        eq(schema.chats.isPublic, true)
      ),
      with: {
        messages: {
          orderBy: () => asc(schema.messages.createdAt)
        },
      }
    })

    if (!chat) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Shared chat not found or no longer public',
        data: { why: 'This share link is invalid or the chat owner has disabled sharing', fix: 'Ask the chat owner for a new share link' },
      })
    }

    const user = await db.select({
      name: schema.user.name,
      image: schema.user.image,
    }).from(schema.user).where(eq(schema.user.id, chat.userId)).get()

    setHeader(event, 'Cache-Control', 's-maxage=300, stale-while-revalidate=3600')

    return {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      messages: chat.messages,
      author: {
        name: user?.name || 'Unknown',
        image: user?.image || '',
      }
    }
  },
  {
    maxAge: 300,
    swr: true,
    getKey: (event) => `shared:v1:${getRouterParam(event, 'token') ?? ''}`,
  },
)
