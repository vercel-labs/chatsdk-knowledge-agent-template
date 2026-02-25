import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  const { user: currentUser } = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing user ID', data: { why: 'The user ID parameter is required in the URL', fix: 'Include the user ID in the request URL: /api/admin/users/:id' } })
  }

  requestLog.set({ adminUserId: currentUser.id, targetUserId: id })

  if (id === currentUser.id) {
    throw createError({ statusCode: 400, message: 'You cannot delete your own account', data: { why: 'Deleting your own account would lock you out', fix: 'Ask another admin to delete your account instead' } })
  }

  const [existingUser] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.id, id))
    .limit(1)

  if (!existingUser) {
    throw createError({ statusCode: 404, message: 'User not found', data: { why: 'No user exists with this ID', fix: 'Verify the user ID from the users list' } })
  }

  // Delete chats first (no FK cascade from chats to user)
  // Messages cascade from chats via FK onDelete: cascade
  await db.delete(schema.chats).where(eq(schema.chats.userId, id))

  // Delete user (sessions, accounts, apikeys cascade via FK)
  await db.delete(schema.user).where(eq(schema.user.id, id))

  return { deleted: true }
})
