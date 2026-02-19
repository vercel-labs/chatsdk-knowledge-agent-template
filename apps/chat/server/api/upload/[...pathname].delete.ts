import { blob } from 'hub:blob'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  const { user } = await requireUserSession(event)
  const { username } = user

  const { pathname } = await getValidatedRouterParams(event, z.object({
    pathname: z.string().min(1)
  }).parse)

  requestLog.set({ pathname, userId: user.id })

  if (!pathname.startsWith(`${username}/`)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'You do not have permission to delete this file',
      data: { why: 'You can only delete files in your own upload folder', fix: 'Verify the file path belongs to your account' },
    })
  }

  await blob.del(pathname)

  return sendNoContent(event)
})
