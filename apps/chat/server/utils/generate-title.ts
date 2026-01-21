import type { UIMessage, UIMessageStreamWriter } from 'ai'
import { generateText } from 'ai'
import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { getLogger } from '@savoir/logger'

interface GenerateTitleOptions {
  firstMessage: UIMessage
  chatId: string
  requestId: string
  writer: UIMessageStreamWriter
}

/**
 * Generate chat title in background and stream it to the client.
 */
export function generateTitle(options: GenerateTitleOptions): void {
  const { firstMessage, chatId, requestId, writer } = options
  const logger = getLogger()

  generateText({
    model: 'google/gemini-3-flash',
    system: `You are a title generator for a chat:
      - Generate a short title based on the first user's message
      - The title should be less than 30 characters long
      - The title should be a summary of the user's message
      - Do not use quotes (' or ") or colons (:) or any other punctuation
      - Do not use markdown, just plain text`,
    prompt: JSON.stringify(firstMessage),
  }).then(async ({ text: title }) => {
    writer.write({
      type: 'data-chat-title',
      data: { title },
      transient: true,
    })

    await db.update(schema.chats).set({ title }).where(eq(schema.chats.id, chatId))
    logger.log('chat', `[${requestId}] Title: ${title}`)
  }).catch(() => {
    logger.log('chat', `[${requestId}] Title generation failed`)
  })
}
