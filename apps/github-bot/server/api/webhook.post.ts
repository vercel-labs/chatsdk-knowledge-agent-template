import { log } from 'evlog'
import { useGitHubChat } from '../utils/chat'

export default defineEventHandler(async (event) => {
  const chat = useGitHubChat()
  const request = toWebRequest(event)

  try {
    await chat.webhooks?.github?.(request)
  }
  catch (error) {
    log.error('github-bot', `Webhook error: ${error instanceof Error ? error.message : 'Unknown'}`)
  }

  return { ok: true }
})
