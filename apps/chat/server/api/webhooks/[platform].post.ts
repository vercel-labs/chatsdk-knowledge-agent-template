import { useBot } from '../../utils/bot/index'

export default defineEventHandler((event) => {
  const platform = getRouterParam(event, 'platform')
  const bot = useBot()

  const handler = bot.webhooks[platform as keyof typeof bot.webhooks]
  if (!handler) {
    setResponseStatus(event, 404)
    return { error: `Unknown platform: ${platform}` }
  }

  const request = toWebRequest(event)
  return handler(request, {
    waitUntil: (task: Promise<unknown>) => {
      if (typeof event.waitUntil === 'function') {
        event.waitUntil(task)
      } else {
        task.catch(() => {})
      }
    },
  })
})
