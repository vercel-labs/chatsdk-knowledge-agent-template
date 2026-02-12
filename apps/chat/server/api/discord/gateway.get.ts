import type { DiscordAdapter } from '@chat-adapter/discord'
import { waitUntil } from '@vercel/functions'
import { createError, useLogger } from 'evlog'
import { useBot } from '../../utils/bot/index'

export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  const bot = useBot()
  await bot.initialize()

  let discord: DiscordAdapter
  try {
    discord = bot.getAdapter('discord') as DiscordAdapter
  } catch {
    requestLog.set({ outcome: 'adapter_not_configured' })
    throw createError({
      message: 'Discord adapter not configured',
      why: 'The Discord adapter requires NUXT_DISCORD_BOT_TOKEN to be set',
      fix: 'Set NUXT_DISCORD_BOT_TOKEN, NUXT_DISCORD_PUBLIC_KEY, and NUXT_DISCORD_APPLICATION_ID in your environment',
    })
  }

  const durationMs = 10 * 60 * 1000
  const { origin } = getRequestURL(event)
  const webhookUrl = `${origin}/api/webhooks/discord`

  requestLog.set({ gatewayDurationMs: durationMs, webhookUrl })

  return discord.startGatewayListener(
    {
      waitUntil: (task: Promise<unknown>) => waitUntil(task),
    },
    durationMs,
    undefined,
    webhookUrl,
  )
})
