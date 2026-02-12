import { Chat, ConsoleLogger, type Adapter, type Message, type Thread } from 'chat'
import { createDiscordAdapter } from '@chat-adapter/discord'
import { createMemoryState } from '@chat-adapter/state-memory'
import { createRedisState } from '@chat-adapter/state-redis'
import { log } from 'evlog'
import { SavoirGitHubAdapter } from './adapters/github'
import { generateAIResponse } from './ai'
import { hasContextProvider } from './types'

let botInstance: Chat | null = null

async function handleBotResponse(thread: Thread, message: Message) {
  const { adapter } = thread

  await adapter.addReaction(thread.id, message.id, 'eyes').catch(() => {})

  try {
    const context = hasContextProvider(adapter)
      ? await adapter.fetchThreadContext(thread.id).catch(() => undefined)
      : { platform: adapter.name, title: '', body: '', labels: [], state: '', source: adapter.name }

    const response = await generateAIResponse(message.text, context)

    await thread.post(response)

    await adapter.removeReaction(thread.id, message.id, 'eyes').catch(() => {})
    await adapter.addReaction(thread.id, message.id, 'thumbs_up').catch(() => {})
  } catch (error) {
    log.error('bot', `Error: ${error instanceof Error ? error.message : 'Unknown'}`)

    await adapter.removeReaction(thread.id, message.id, 'eyes').catch(() => {})

    try {
      await thread.post(`Sorry, I encountered an error while processing your request. Please try again later.

<details>
<summary>Error details</summary>

\`\`\`
${error instanceof Error ? error.message : 'Unknown error'}
\`\`\`
</details>`)
    } catch (error) {
      log.error('bot', `Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }
}

function createBot(): Chat {
  const config = useRuntimeConfig()

  const botUserName = (config.public.github?.botTrigger as string).replace('@', '')

  const adapters: Record<string, Adapter> = {}

  if (config.github.appId && config.github.appPrivateKey && config.github.webhookSecret) {
    adapters.github = new SavoirGitHubAdapter({
      appId: config.github.appId,
      privateKey: config.github.appPrivateKey,
      webhookSecret: config.github.webhookSecret,
      userName: botUserName,
      replyToNewIssues: config.github.replyToNewIssues as boolean,
    })
  }

  if (config.discord.botToken) {
    adapters.discord = createDiscordAdapter({
      botToken: config.discord.botToken,
      publicKey: config.discord.publicKey,
      applicationId: config.discord.applicationId,
      mentionRoleIds: config.discord.mentionRoleIds
        ? (config.discord.mentionRoleIds as string).split(',').filter(Boolean)
        : undefined,
      logger: new ConsoleLogger('info').child('discord'),
    })
  }

  const redisUrl = process.env.REDIS_URL
  const state = redisUrl
    ? createRedisState({ url: redisUrl, logger: new ConsoleLogger('info').child('redis-state') })
    : createMemoryState()

  const bot = new Chat({
    userName: botUserName,
    adapters,
    state,
    logger: 'info',
  })

  // Direct mentions — works for any adapter
  bot.onNewMention(async (thread, message) => {
    await handleBotResponse(thread, message)
  })

  // Thread continuation — respond in threads where the bot already participated (Discord only)
  bot.onNewMessage(/.*/, async (thread, message) => {
    if (message.isMention || message.author.isBot) return
    if (thread.adapter.name === 'github') return

    const { messages } = await thread.adapter.fetchMessages(thread.id, { limit: 50 })
    const botHasReplied = messages.some((m: Message) => m.author.isBot)
    if (!botHasReplied) return

    await handleBotResponse(thread, message)
  })

  return bot
}

export function useBot(): Chat {
  if (!botInstance) botInstance = createBot()
  return botInstance
}
