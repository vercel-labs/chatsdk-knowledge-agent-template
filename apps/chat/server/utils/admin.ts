import type { H3Event } from 'h3'

export async function requireAdmin(event: H3Event) {
  const session = await getUserSession(event)
  if (!session.user || session.user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }
  return session
}
