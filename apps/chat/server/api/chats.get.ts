import { db, schema } from '@nuxthub/db'
import { eq, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  return await db.query.chats.findMany({
    where: () => eq(schema.chats.userId, user.id),
    orderBy: () => desc(schema.chats.createdAt)
  })
})
