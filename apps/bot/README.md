# @savoir/bot

Multi-platform documentation bot powered by [chat-sdk](https://github.com/vercel-labs/chat).

## Setup

```bash
cp .env.example .env
# Fill in the env vars (see platform guides below)
bun run dev:bot
```

For development, expose port 3001 with a tunnel and configure the webhook URL as `https://<tunnel>/api/webhooks/<platform>`:

```bash
ngrok http http://[::1]:3001
```

> [!NOTE]
> Use `http://[::1]:3001` (IPv6) if your dev server listens on `::1`. Check the Nitro startup log for the listening address.

### GitHub setup

1. Create a [GitHub App](https://github.com/settings/apps/new) with the following settings:

   | Setting | Value |
   |---------|-------|
   | Webhook URL | `https://<tunnel>/api/webhooks/github` |
   | Webhook secret | Choose a secret, put it in `NUXT_GITHUB_WEBHOOK_SECRET` |

2. Set these **permissions**:

   | Permission | Access |
   |------------|--------|
   | Issues | Read & Write |
   | Pull requests | Read & Write |
   | Metadata | Read-only |

3. Subscribe to these **events**: `Issues`, `Issue comment`, `Pull request`, `Pull request review comment`

4. After creating the app, generate a **private key** and fill in `.env`:

   ```
   NUXT_GITHUB_APP_ID=123456
   NUXT_GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   NUXT_GITHUB_WEBHOOK_SECRET=your_secret
   NUXT_PUBLIC_BOT_TRIGGER=@your-app-slug
   ```

5. Install the app on the repositories you want the bot to respond in.

### Discord setup

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).

2. Go to **Bot** and:
   - Copy the **Token** → `NUXT_DISCORD_BOT_TOKEN`
   - Enable **Privileged Gateway Intents**: `Message Content`, `Server Members`

3. Go to **General Information** and copy:
   - **Application ID** → `NUXT_DISCORD_APPLICATION_ID`
   - **Public Key** → `NUXT_DISCORD_PUBLIC_KEY`

4. Go to **General Information** > **Interactions Endpoint URL** and set it to:
   ```
   https://<tunnel>/api/webhooks/discord
   ```
   Discord will send a PING to verify — the bot must be running.

5. Invite the bot to your server using the OAuth2 URL Generator (**Bot** scope, permissions: `Send Messages`, `Add Reactions`, `Read Message History`, `Create Public Threads`).

6. Fill in `.env`:
   ```
   NUXT_DISCORD_BOT_TOKEN=your_token
   NUXT_DISCORD_PUBLIC_KEY=your_public_key
   NUXT_DISCORD_APPLICATION_ID=your_app_id
   NUXT_DISCORD_MENTION_ROLE_IDS=optional_role_id
   ```

7. Start the **Gateway listener** so the bot can receive messages (Discord interactions alone don't cover @mentions):

   ```bash
   curl http://localhost:3001/api/discord/gateway
   ```

   In production, set up a cron job every ~9 minutes to call this endpoint (the Gateway connection lasts 10 minutes).

> [!TIP]
> If you mention the bot via a **role** (`@BotRole`), you must add that role ID to `NUXT_DISCORD_MENTION_ROLE_IDS`. Direct user mentions (`@BotUser`) work without this.

## Architecture

```
server/
  api/
    webhooks/[platform].post.ts      # Dynamic webhook router (GitHub, Discord, ...)
    discord/gateway.get.ts           # Discord Gateway listener (for serverless cron)
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
