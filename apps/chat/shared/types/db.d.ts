import type { chats, messages, sources } from '@nuxthub/db/schema'

export type Chat = typeof chats.$inferSelect
export type Message = typeof messages.$inferSelect
export type Source = typeof sources.$inferSelect
