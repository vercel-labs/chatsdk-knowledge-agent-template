import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  const { user } = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing API key ID', data: { why: 'The API key ID parameter is required in the URL', fix: 'Include the API key ID in the request URL: /api/admin/api-keys/:id' } })
  }

  requestLog.set({ adminUserId: user.id, apiKeyId: id })

  await db.delete(schema.apikey).where(eq(schema.apikey.id, id))

  return { deleted: true }
})
