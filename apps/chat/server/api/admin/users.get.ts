import { db, schema } from '@nuxthub/db'
import { desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  await requireAdmin(event)

  const [users, chats, messages] = await Promise.all([
    db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        image: schema.user.image,
        role: schema.user.role,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)
      .orderBy(desc(schema.user.createdAt)),
    db
      .select({
        id: schema.chats.id,
        userId: schema.chats.userId,
        createdAt: schema.chats.createdAt,
      })
      .from(schema.chats),
    db
      .select({
        chatId: schema.messages.chatId,
        createdAt: schema.messages.createdAt,
      })
      .from(schema.messages),
  ])

  const chatOwnerById = new Map<string, string>()
  const chatCountByUserId = new Map<string, number>()
  const lastSeenByUserId = new Map<string, Date>()

  for (const chat of chats) {
    chatOwnerById.set(chat.id, chat.userId)
    chatCountByUserId.set(chat.userId, (chatCountByUserId.get(chat.userId) ?? 0) + 1)

    const previousLastSeen = lastSeenByUserId.get(chat.userId)
    if (!previousLastSeen || previousLastSeen < chat.createdAt) {
      lastSeenByUserId.set(chat.userId, chat.createdAt)
    }
  }

  const messageCountByUserId = new Map<string, number>()

  for (const message of messages) {
    const userId = chatOwnerById.get(message.chatId)
    if (!userId) continue

    messageCountByUserId.set(userId, (messageCountByUserId.get(userId) ?? 0) + 1)

    const previousLastSeen = lastSeenByUserId.get(userId)
    if (!previousLastSeen || previousLastSeen < message.createdAt) {
      lastSeenByUserId.set(userId, message.createdAt)
    }
  }

  requestLog.set({ userCount: users.length })

  return users.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role ?? 'user',
    createdAt: user.createdAt,
    chatCount: chatCountByUserId.get(user.id) ?? 0,
    messageCount: messageCountByUserId.get(user.id) ?? 0,
    lastSeenAt: lastSeenByUserId.get(user.id) ?? null,
  }))
})
