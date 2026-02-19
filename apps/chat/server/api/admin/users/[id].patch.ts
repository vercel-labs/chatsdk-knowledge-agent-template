import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  role: z.enum(['user', 'admin']),
})

export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  const { user: currentUser } = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing user ID', data: { why: 'The user ID parameter is required in the URL', fix: 'Include the user ID in the request URL: /api/admin/users/:id' } })
  }

  const body = await readValidatedBody(event, bodySchema.parse)

  requestLog.set({ adminUserId: currentUser.id, targetUserId: id, role: body.role })

  if (id === currentUser.id && body.role !== 'admin') {
    throw createError({ statusCode: 400, message: 'You cannot remove your own admin role', data: { why: 'Removing your own admin role would lock you out of admin features', fix: 'Ask another admin to change your role instead' } })
  }

  const [existingUser] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.id, id))
    .limit(1)

  if (!existingUser) {
    throw createError({ statusCode: 404, message: 'User not found', data: { why: 'No user exists with this ID', fix: 'Verify the user ID from the users list' } })
  }

  await db
    .update(schema.user)
    .set({ role: body.role })
    .where(eq(schema.user.id, id))

  return { success: true }
})
