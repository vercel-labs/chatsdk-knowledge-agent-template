import { db, schema } from '@nuxthub/db'
import { desc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return db
    .select({
      id: schema.apikey.id,
      name: schema.apikey.name,
      prefix: schema.apikey.prefix,
      start: schema.apikey.start,
      userId: schema.apikey.userId,
      enabled: schema.apikey.enabled,
      expiresAt: schema.apikey.expiresAt,
      createdAt: schema.apikey.createdAt,
      userName: schema.user.name,
      userEmail: schema.user.email,
      userImage: schema.user.image,
      userRole: schema.user.role,
    })
    .from(schema.apikey)
    .leftJoin(schema.user, eq(schema.user.id, schema.apikey.userId))
    .orderBy(desc(schema.apikey.createdAt))
})
