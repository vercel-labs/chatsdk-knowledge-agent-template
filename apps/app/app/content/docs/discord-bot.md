# Discord Bot Setup

The Knowledge Agent Template Discord bot responds to mentions and continues conversations in threads, using your knowledge base to provide answers.

## Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and give it a name
3. Note the **Application ID** and **Public Key** from the General Information page

### Create the Bot

1. Go to the **Bot** section in the left sidebar
2. Click **Reset Token** and save the bot token
3. Enable **Message Content Intent** under Privileged Gateway Intents (required for reading message content)

### Configure OAuth2

1. Go to **OAuth2 > URL Generator**
2. Select scopes: `bot`, `applications.commands`
3. Select bot permissions: `Send Messages`, `Read Message History`, `Add Reactions`
4. Use the generated URL to invite the bot to your server

See the [Discord OAuth2 documentation](https://discord.com/developers/docs/topics/oauth2) for more details on scopes and permissions.

## Set the Interactions Endpoint

1. In the [Discord Developer Portal](https://discord.com/developers/applications), go to **General Information**
2. Set **Interactions Endpoint URL** to: `<your-url>/api/webhooks/discord`
3. Discord will verify the endpoint before saving -- make sure your app is running

## Environment Variables

Add the following to your `.env` file:

| Variable | Description |
|----------|-------------|
| `NUXT_DISCORD_BOT_TOKEN` | The bot token from the Bot section |
| `NUXT_DISCORD_PUBLIC_KEY` | The public key from General Information |
| `NUXT_DISCORD_APPLICATION_ID` | The application ID from General Information |
| `NUXT_DISCORD_MENTION_ROLE_IDS` | (Optional) Comma-separated [role IDs](https://discord.com/developers/docs/resources/guild#guild-role-object) that can trigger the bot |

## How It Works

The Discord bot is built on the [Vercel Chat SDK](https://github.com/vercel-labs/chat) with the `@chat-adapter/discord` adapter.

### Mentions

Mention the bot in any channel:

```
@your-bot How do I configure authentication?
```

The bot will reply in the same channel with an answer from the knowledge base, using the same AI agent pipeline as the [chat interface](/admin/docs/getting-started#how-it-works) and [GitHub bot](/admin/docs/github-bot).

### Thread Continuation

Once the bot has replied in a thread, it will continue responding to follow-up messages in that thread -- no need to mention it again. This allows natural back-and-forth conversations.

The bot only continues threads where it has previously participated. It does not respond to messages in threads it hasn't been part of.

### Role-Based Triggering

If `NUXT_DISCORD_MENTION_ROLE_IDS` is set, the bot will also respond when those roles are mentioned. This is useful for creating a role like `@ask-docs` that triggers the bot.

## State Management

Bot conversation state is stored in:
- [**Redis**](https://upstash.com/docs/redis) if `REDIS_URL` is set (recommended for production -- state persists across restarts)
- **In-memory** as fallback (state is lost on restart)

For the full architecture and how to build custom adapters, see the [Architecture](https://github.com/vercel-labs/knowledge-agent-template/blob/main/docs/ARCHITECTURE.md) and [Customization Guide](https://github.com/vercel-labs/knowledge-agent-template/blob/main/docs/CUSTOMIZATION.md#4-add-a-bot-adapter) on GitHub.
