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
        user: {
          columns: {
            name: true,
            avatar: true,
            username: true
          }
        }
      }
    })

    if (!chat) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Shared chat not found or no longer public'
      })
    }

    setHeader(event, 'Cache-Control', 's-maxage=300, stale-while-revalidate=3600')

    return {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      messages: chat.messages,
      author: chat.user
    }
  },
  {
    maxAge: 300,
    swr: true,
    getKey: (event) => `shared:v1:${getRouterParam(event, 'token') ?? ''}`,
  },
)
