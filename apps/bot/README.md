# @savoir/bot

Multi-platform documentation bot powered by [chat-sdk](https://github.com/vercel-labs/chat).

## Setup

```bash
cp .env.example .env
# Fill in the env vars
bun run dev:bot
```

Expose port 3001 with a tunnel (ngrok, cloudflared) and configure the webhook URL as `https://<tunnel>/api/webhooks/<platform>`.

## Architecture

```
server/
  api/webhooks/[platform].post.ts   # Dynamic webhook router
  utils/
    bot.ts                           # Chat instance + mention handler
    ai.ts                            # AI pipeline (platform-agnostic)
    types.ts                         # ThreadContext, ContextProvider
    router-schema.ts                 # Complexity classification schema
    adapters/
      github.ts                      # GitHub adapter (issues + PRs)
```

The mention handler in `bot.ts` is platform-agnostic. It uses `thread.adapter` to interact with whatever platform the message came from, and the `ContextProvider` interface for optional context enrichment.

## chat-sdk resources

- [GitHub repo](https://github.com/vercel-labs/chat) — source, examples, and README
- [`chat` on npm](https://www.npmjs.com/package/chat) — core SDK (`Chat`, `Adapter`, `Message`, `Thread`)
- [`@chat-adapter/state-memory`](https://www.npmjs.com/package/@chat-adapter/state-memory) — in-memory state (dev/single-instance)
- [`@chat-adapter/state-redis`](https://www.npmjs.com/package/@chat-adapter/state-redis) — Redis state (production)
- [`@chat-adapter/github`](https://www.npmjs.com/package/@chat-adapter/github) — official GitHub adapter (PR-only, we use a custom one for issues)
- [`@chat-adapter/slack`](https://www.npmjs.com/package/@chat-adapter/slack) — official Slack adapter
- [`@chat-adapter/discord`](https://www.npmjs.com/package/@chat-adapter/discord) — official Discord adapter

## Adding a new adapter

### 1. Create the adapter file

```
server/utils/adapters/slack.ts
```

Implement the `Adapter` interface from `chat` and optionally the `ContextProvider` interface from `../types`:

```typescript
import type { Adapter, ChatInstance, /* ... */ } from 'chat'
import type { ThreadContext, ContextProvider } from '../types'

export class SlackAdapter implements Adapter<SlackThreadId, SlackRawMessage>, ContextProvider {
  readonly name = 'slack'
  readonly userName: string

  // ... implement all Adapter methods:
  // initialize, handleWebhook, postMessage, editMessage, deleteMessage,
  // addReaction, removeReaction, startTyping, fetchMessages, fetchThread,
  // encodeThreadId, decodeThreadId, parseMessage, renderFormatted

  // Optional: implement ContextProvider for AI context enrichment
  async fetchThreadContext(threadId: string): Promise<ThreadContext> {
    return {
      platform: 'slack',
      title: '...',
      body: '...',
      labels: [],
      state: 'open',
      source: 'workspace/channel',
    }
  }
}
```

If `fetchThreadContext` is implemented, the AI pipeline automatically uses it to enrich the prompt. If not, the bot still works — it just won't have extra context.

### 2. Register the adapter in `bot.ts`

```typescript
import { SlackAdapter } from './adapters/slack'

const slack = new SlackAdapter({
  botToken: config.slack.botToken,
  signingSecret: config.slack.signingSecret,
  userName: botUserName,
})

const bot = new Chat({
  userName: botUserName,
  adapters: { github, slack },
  state: createMemoryState(),
  logger: 'info',
})
```

### 3. Add config to `nuxt.config.ts`

```typescript
runtimeConfig: {
  github: { /* ... */ },
  slack: {
    botToken: '',
    signingSecret: '',
  },
},
```

### 4. Done

The webhook endpoint `/api/webhooks/slack` is automatically available. The `onNewMention` handler works for all adapters — no changes needed.

## Stats tracking

The bot automatically reports usage stats (tokens, duration, model) to the main Savoir app after each AI response via `savoir.reportUsage()` from `@savoir/sdk`. Stats appear in the admin dashboard under the source name `<platform>-bot` (e.g. `github-bot`, `slack-bot`).

The `source` and `sourceId` are passed to `createSavoir()` at initialization, so usage tracking is transparent — no manual API calls needed. If your adapter implements `ContextProvider`, stats tracking works automatically with the correct platform name and issue number.

## ContextProvider

The `ContextProvider` interface is optional. It lets an adapter provide platform-specific context to the AI pipeline:

```typescript
interface ThreadContext {
  platform: string      // "github", "slack", "discord"
  title: string         // issue title, channel topic, thread subject
  body: string          // issue body, first message
  labels: string[]      // labels, tags
  state: string         // "open", "closed", "active"
  source: string        // "owner/repo", "workspace/channel"
  number?: number       // issue/ticket number
  previousComments?: Array<{ author: string, body: string, isBot: boolean }>
}
```

The `hasContextProvider()` type guard in `types.ts` checks at runtime if an adapter implements it.
