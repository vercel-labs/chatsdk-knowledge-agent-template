import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  role: z.enum(['user', 'admin']),
})

export default defineEventHandler(async (event) => {
  const { user: currentUser } = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing user ID' })
  }

  const body = await readValidatedBody(event, bodySchema.parse)

  if (id === currentUser.id && body.role !== 'admin') {
    throw createError({ statusCode: 400, message: 'You cannot remove your own admin role' })
  }

  const [existingUser] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.id, id))
    .limit(1)

  if (!existingUser) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  await db
    .update(schema.user)
    .set({ role: body.role })
    .where(eq(schema.user.id, id))

  return { success: true }
})
