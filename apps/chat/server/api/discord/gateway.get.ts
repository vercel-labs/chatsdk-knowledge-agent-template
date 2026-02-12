import type { DiscordAdapter } from '@chat-adapter/discord'
import { useBot } from '../../utils/bot/index'

export default defineEventHandler(async (event) => {
  const bot = useBot()
  await bot.initialize()

  let discord: DiscordAdapter
  try {
    discord = bot.getAdapter('discord') as DiscordAdapter
  } catch {
    throw createError({ statusCode: 404, message: 'Discord adapter not configured' })
  }

  const durationMs = 10 * 60 * 1000
  const { origin } = getRequestURL(event)
  const webhookUrl = `${origin}/api/webhooks/discord`

  return discord.startGatewayListener(
    {
      waitUntil: (task: Promise<unknown>) => {
        if (typeof event.waitUntil === 'function') {
          event.waitUntil(task)
        } else {
          task.catch(() => {})
        }
      },
    },
    durationMs,
    undefined,
    webhookUrl,
  )
})
