import { Chat, ConsoleLogger, type Adapter } from 'chat'
import { createDiscordAdapter } from '@chat-adapter/discord'
import { createMemoryState } from '@chat-adapter/state-memory'
import { log } from 'evlog'
import { SavoirGitHubAdapter } from './adapters/github'
import { generateAIResponse } from './ai'
import { hasContextProvider } from './types'

let botInstance: Chat | null = null

function createBot(): Chat {
  const config = useRuntimeConfig()

  const botUserName = (config.public.botTrigger as string).replace('@', '')

  const github = new SavoirGitHubAdapter({
    appId: config.github.appId,
    privateKey: config.github.appPrivateKey,
    webhookSecret: config.github.webhookSecret,
    userName: botUserName,
    replyToNewIssues: config.github.replyToNewIssues as boolean,
  })

  const adapters: Record<string, Adapter> = { github }

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

  const bot = new Chat({
    userName: botUserName,
    adapters,
    state: createMemoryState(),
    logger: 'info',
  })

  // Platform-agnostic mention handler — works for any adapter
  bot.onNewMention(async (thread, message) => {
    const { adapter } = thread

    // Acknowledge with a reaction (works on any platform that supports it)
    await adapter.addReaction(thread.id, message.id, 'eyes').catch(() => {})

    try {
      const context = hasContextProvider(adapter)
        ? await adapter.fetchThreadContext(thread.id).catch(() => undefined)
        : { platform: adapter.name, title: '', body: '', labels: [], state: '', source: adapter.name }

      const response = await generateAIResponse(message.text, context)

      await thread.post(response)

      // Swap reactions
      await adapter.removeReaction(thread.id, message.id, 'eyes').catch(() => {})
      await adapter.addReaction(thread.id, message.id, '+1').catch(() => {})
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
  })

  return bot
}

export function useBot(): Chat {
  if (!botInstance) botInstance = createBot()
  return botInstance
}
