import { db } from '@nuxthub/db'
import { sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing API key ID' })
  }

  await db.run(sql`DELETE FROM "apikey" WHERE id = ${id}`)

  return { deleted: true }
})
