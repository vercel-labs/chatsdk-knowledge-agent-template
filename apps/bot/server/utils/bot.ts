import { Chat } from 'chat'
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

  const bot = new Chat({
    userName: botUserName,
    adapters: { github },
    state: createMemoryState(),
    logger: 'info',
  })

  // Platform-agnostic mention handler — works for any adapter
  bot.onNewMention(async (thread, message) => {
    const adapter = thread.adapter

    // Acknowledge with a reaction (works on any platform that supports it)
    await adapter.addReaction(thread.id, message.id, 'eyes').catch(() => {})

    try {
      // Fetch enriched context if the adapter supports it
      const context = hasContextProvider(adapter)
        ? await adapter.fetchThreadContext(thread.id).catch(() => undefined)
        : undefined

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
