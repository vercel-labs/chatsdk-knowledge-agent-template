import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
}

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull(),
  name: text('name').notNull(),
  avatar: text('avatar').notNull(),
  username: text('username').notNull(),
  provider: text('provider').notNull(), // 'github'
  providerId: text('provider_id').notNull(),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  ...timestamps
}, table => [uniqueIndex('users_provider_id_idx').on(table.provider, table.providerId)])

export const usersRelations = relations(users, ({ many }) => ({
  chats: many(chats)
}))

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title'),
  userId: text('user_id').notNull(),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  shareToken: text('share_token'),
  ...timestamps
}, table => [
  index('chats_user_id_idx').on(table.userId),
  uniqueIndex('chats_share_token_idx').on(table.shareToken)
])

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users, {
    fields: [chats.userId],
    references: [users.id]
  }),
  messages: many(messages)
}))

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  chatId: text('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  parts: text('parts', { mode: 'json' }),
  ...timestamps
}, table => [index('messages_chat_id_idx').on(table.chatId)])

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id]
  })
}))

export const sources = sqliteTable('sources', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type', { enum: ['github', 'youtube'] }).notNull(),

  // Common fields
  label: text('label').notNull(),

  // Common output field
  basePath: text('base_path').default('/docs'),

  // GitHub fields
  repo: text('repo'),
  branch: text('branch'),
  contentPath: text('content_path'),
  outputPath: text('output_path'),
  readmeOnly: integer('readme_only', { mode: 'boolean' }).default(false),

  // YouTube fields
  channelId: text('channel_id'),
  handle: text('handle'),
  maxVideos: integer('max_videos').default(50),

  // Metadata
  ...timestamps,
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, table => [index('sources_type_idx').on(table.type)])
