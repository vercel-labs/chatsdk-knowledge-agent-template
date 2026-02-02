import { Chat } from 'chat'
import { log } from 'evlog'
import { createGitHubAdapter, type GitHubAdapter } from './adapter'
import { generateAIResponse } from './ai'
import { KVStateAdapter } from './state-kv'
import type { IssueContext } from './types'

let chatInstance: Chat | null = null

export function useGitHubChat(): Chat {
  if (chatInstance) {
    return chatInstance
  }

  const config = useRuntimeConfig()

  if (!config.github.webhookSecret) {
    throw new Error('NUXT_GITHUB_WEBHOOK_SECRET is required')
  }

  const botTrigger = config.public.botTrigger as string
  const botUserName = botTrigger.replace('@', '')

  if (!config.github.appId || !config.github.appPrivateKey) {
    throw new Error('NUXT_GITHUB_APP_ID and NUXT_GITHUB_APP_PRIVATE_KEY are required')
  }

  chatInstance = new Chat({
    userName: botUserName,
    adapters: {
      github: createGitHubAdapter({
        userName: botUserName,
        webhookSecret: config.github.webhookSecret,
        appId: config.github.appId,
        appPrivateKey: config.github.appPrivateKey,
      }),
    },
    state: new KVStateAdapter(),
    logger: 'info',
  })

  chatInstance.onNewMention(async (thread, message) => {
    try {
      const adapter = thread.adapter as GitHubAdapter
      await adapter.addReaction(thread.id, message.id, 'eyes')

      let issueContext: IssueContext | undefined
      try {
        issueContext = await adapter.fetchIssueContext(thread.id)
      }
      catch {
        // Continue without issue context
      }

      const response = await generateAIResponse(message.text, issueContext)

      await thread.post({ markdown: response })

      await adapter.removeReaction(thread.id, message.id, 'eyes')
      await adapter.addReaction(thread.id, message.id, 'thumbs_up')
    }
    catch (error) {
      log.error('github-bot', `Error: ${error instanceof Error ? error.message : 'Unknown'}`)

      try {
        await thread.post({
          markdown: `Sorry, I encountered an error while processing your request. Please try again later.\n\n<details>\n<summary>Error details</summary>\n\n\`\`\`\n${error instanceof Error ? error.message : 'Unknown error'}\n\`\`\`\n</details>`,
        })
      }
      catch {
        // Ignore error posting failure
      }
    }
  })

  return chatInstance
}
