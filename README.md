# Savoir

Build AI agents with real-time knowledge access.

Savoir provides the infrastructure to create file-based AI agents (chatbots, Discord bots, GitHub bots, etc.) that can search and read from frequently updated knowledge bases. It combines a unified Nuxt application for the chat interface and API with an SDK that provides AI SDK-compatible tools.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your AI Application                       │
│                     (Discord bot, GitHub bot, etc.)              │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                          @savoir/sdk                             │
│              AI SDK compatible tools (searchAndRead, etc.)       │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ API calls
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         apps/chat                                │
│                    (Unified Nuxt Application)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │   Sandbox   │  │   Content    │  │   Vercel Workflows     │  │
│  │   Manager   │  │     Sync     │  │   (scheduled sync)     │  │
│  └──────┬──────┘  └──────┬───────┘  └────────────────────────┘  │
└─────────┼────────────────┼──────────────────────────────────────┘
          │                │
          ▼                ▼
   ┌────────────┐   ┌─────────────┐
   │   Vercel   │   │   GitHub    │
   │   Sandbox  │   │  Snapshot   │
   │            │   │    Repo     │
   └────────────┘   └─────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| [`@savoir/sdk`](./packages/sdk) | AI SDK compatible tools for agents |
| [`@savoir/logger`](./packages/logger) | Logging utilities |
| [`apps/chat`](./apps/chat) | Unified Nuxt app (chat UI + API) |

## Quick Start

### Using the SDK

```typescript
import { generateText } from 'ai'
import { createSavoir } from '@savoir/sdk'

// Initialize Savoir client
const savoir = createSavoir({
  apiKey: process.env.SAVOIR_API_KEY,
  apiUrl: process.env.SAVOIR_API_URL || 'https://savoir.example.com'
})

// Use with AI SDK
const { text } = await generateText({
  model: 'google/gemini-3-flash',
  prompt: 'Tell me the latest developments in Nuxt',
  tools: {
    ...savoir.tools,
  }
})

console.log(text)
```

### Self-hosting

```bash
# Clone the repository
git clone https://github.com/HugoRCD/savoir.git
cd savoir

# Install dependencies
bun install

# Configure environment variables
cp apps/chat/.env.example apps/chat/.env
# Edit .env with your configuration

# Run database migrations
turbo run db:migrate --filter=@savoir/chat

# Start the app
bun run dev
```

**Required environment variables:**

```bash
# GitHub token for cloning snapshot repository
NUXT_GITHUB_TOKEN=ghp_...

# Repository containing the content snapshot
NUXT_GITHUB_SNAPSHOT_REPO=your-org/your-content-repo

# Optional: API key for securing endpoints
NUXT_SAVOIR_SECRET_KEY=your-secret-key
```

## Configuration

Sources are stored in the database and can be managed via the API (`/api/sources`). See `savoir.config.ts` at the project root for example source definitions:

The config file format:

```typescript
// savoir.config.ts
export default {
  sources: {
    github: [
      { id: 'nuxt', repo: 'nuxt/nuxt', contentPath: 'docs' },
      { id: 'nitro', repo: 'nitrojs/nitro', branch: 'main' },
    ],
    youtube: [
      { id: 'alex-lichter', channelId: 'UCqFPgMzGbLjd-MX-h3Z5aQA' },
    ],
  },
}
```

See [SOURCES.md](./docs/SOURCES.md) for detailed source configuration options.

## How It Works

1. **Sources in Database**: Sources are stored in SQLite via NuxtHub, seeded from `savoir.config.ts`
2. **Content Aggregation**: Sources (GitHub docs, YouTube transcripts, etc.) are synced to a snapshot repository via Vercel Workflow
3. **Sandbox Creation**: When an agent needs to search, the API creates/recovers a Vercel Sandbox with the snapshot repo cloned
4. **File-based Search**: The SDK tools execute grep/find commands in the sandbox to search and read content
5. **AI Integration**: Tools are compatible with the Vercel AI SDK for seamless integration with any LLM

## Development

```bash
# Install dependencies
bun install

# Start the app in dev mode
bun run dev

# Build all packages
bun run build

# Run tests
bun run test

# Lint and fix
bun run lint:fix
```

## Related Projects

- [Vercel AI SDK](https://ai-sdk.dev) - The AI SDK that Savoir integrates with
- [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) - Sandboxed execution environment
- [NuxtHub](https://hub.nuxt.com) - The deployment platform for Nuxt
- [Vercel Workflow](https://github.com/vercel/workflow) - Durable workflow execution

## License

[MIT](./LICENSE)
