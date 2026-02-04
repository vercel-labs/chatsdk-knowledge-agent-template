import type { UIMessage, UIMessageStreamWriter } from 'ai'
import { generateText } from 'ai'
import { db, schema } from '@nuxthub/db'
import { eq } from 'drizzle-orm'
import { log } from 'evlog'

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

  generateText({
    model: 'google/gemini-2.5-flash-lite',
    system: `Generate a short chat title (max 30 chars) from the user's message.
Rules: no quotes, no colons, no punctuation, plain text only.
If the message is a simple greeting (hi, hey, hello, etc.), respond with a generic title like "New conversation" or "Quick chat".`,
    prompt: JSON.stringify(firstMessage),
  }).then(async ({ text: title }) => {
    writer.write({
      type: 'data-chat-title',
      data: { title },
      transient: true,
    })

    await db.update(schema.chats).set({ title }).where(eq(schema.chats.id, chatId))
    log.info('chat', `${requestId} Title: ${title}`)
  }).catch(() => {
    log.error('chat', `${requestId} Title generation failed`)
  })
}
