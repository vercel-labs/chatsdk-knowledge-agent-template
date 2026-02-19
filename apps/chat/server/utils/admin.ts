import type { H3Event } from 'h3'

export async function requireAdmin(event: H3Event) {
  const { user } = await requireUserSession(event)
  if (user.role !== 'admin') {
    throw createError({ statusCode: 403, message: 'Admin access required', data: { why: 'This endpoint requires the admin role', fix: 'Contact an administrator to be granted access' } })
  }
  return { user }
}
