# Savoir

## Project Overview

Savoir is a platform for building AI agents with access to real-time knowledge bases. It provides:

- **API** (`apps/api`): A self-hostable Nitro server managing Vercel Sandboxes and content synchronization
- **SDK** (`packages/sdk`): AI SDK-compatible tools for integrating knowledge search into agents

The system enables file-based agents that can grep, search, and read from frequently updated documentation sources.

## Documentation

For detailed technical information, see:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - Complete technical architecture, API specifications, component details, and implementation patterns
- [`docs/SOURCES.md`](docs/SOURCES.md) - Content sources system, configuration, sync process, and how to add new sources

## Architecture

### Monorepo Structure

```
savoir/
├── apps/
│   ├── api/                  # Nitro API server
│   │   ├── server/
│   │   │   ├── api/          # API endpoints
│   │   │   │   ├── sandbox/  # Sandbox management endpoints
│   │   │   │   └── sync/     # Content sync endpoints
│   │   │   ├── tasks/        # Nitro scheduled tasks
│   │   │   └── utils/        # Shared utilities
│   │   └── nitro.config.ts
│   ├── chat/                 # Example chat application
│   └── github-bot/           # Example GitHub bot
├── packages/
│   ├── sdk/                  # @savoir/sdk - AI SDK tools
│   │   └── src/
│   │       ├── index.ts      # createSavoir() export
│   │       ├── client.ts     # API client
│   │       └── tools/        # AI SDK tool definitions
│   └── cli/                  # CLI utilities
└── docs/                     # Architecture documentation
```

### Data Flow

```
┌──────────────┐     ┌─────────────┐     ┌──────────────────┐
│  AI Agent    │────▶│ @savoir/sdk │────▶│   Savoir API     │
│  (Your App)  │     │   (tools)   │     │   (Nitro)        │
└──────────────┘     └─────────────┘     └────────┬─────────┘
                                                  │
                           ┌──────────────────────┼──────────────────────┐
                           │                      │                      │
                           ▼                      ▼                      ▼
                    ┌────────────┐        ┌────────────┐        ┌────────────┐
                    │  Sandbox   │        │  Content   │        │   Nitro    │
                    │  Manager   │        │   Sync     │        │   Tasks    │
                    └─────┬──────┘        └─────┬──────┘        └────────────┘
                          │                     │
                          ▼                     ▼
                    ┌────────────┐        ┌────────────┐
                    │   Vercel   │        │   GitHub   │
                    │   Sandbox  │        │   Repo     │
                    └────────────┘        └────────────┘
```

### Key Components

#### Sandbox Manager

Manages Vercel Sandbox lifecycle:

- **Create**: Clones snapshot repo into new sandbox
- **Recover**: Reuses existing sandbox by ID (stored in KV)
- **Extend**: Extends sandbox timeout when running low
- **Execute**: Runs shell commands (grep, cat, find) for search/read

#### Content Sync

Aggregates documentation from multiple sources:

- Fetches from GitHub repositories (docs, READMEs)
- Processes YouTube transcripts
- Normalizes to Markdown format
- Pushes to snapshot repository

#### SDK Tools

AI SDK-compatible tools:

- `searchAndRead`: Combined search + read (most efficient)
- `search`: Search for file paths matching query
- `read`: Read specific files by path

## API Endpoints

### Sandbox Management

```
POST /api/sandbox/create
  Body: { chatId: string }
  Returns: { sandboxId: string, fileTree: string }

POST /api/sandbox/:id/search
  Body: { query: string, limit?: number }
  Returns: { files: string[] }

POST /api/sandbox/:id/read
  Body: { paths: string[] }
  Returns: { files: Array<{ path: string, content: string }> }

POST /api/sandbox/:id/search-and-read
  Body: { query: string, limit?: number }
  Returns: { query: string, files: Array<{ path: string, content: string }> }
```

### Content Sync

```
POST /api/sync
  Triggers full content synchronization

POST /api/sync/:source
  Triggers sync for specific source

GET /api/sources
  Returns list of configured sources
```

## SDK Usage

```typescript
import { createSavoir } from '@savoir/sdk'
import { generateText, stepCountIs } from 'ai'

// Initialize client
const savoir = createSavoir({
  apiKey: process.env.SAVOIR_API_KEY,
  apiUrl: 'https://api.savoir.example.com'
})

// Use tools with AI SDK
const { text } = await generateText({
  model: 'google/gemini-3-flash',
  prompt: 'How do I use useAsyncData in Nuxt?',
  tools: {
    ...savoir.tools,
  }
})
```

## Code Guidelines

### Comments

Only add comments when the code is truly complex or non-obvious. Avoid section divider comments in templates like `<!-- Header -->`, `<!-- Actions -->`, etc. Well-structured code with clear naming is self-documenting.

**Exception:** Section dividers ARE useful in data structures (schemas, configs, type definitions) to group related fields.

```typescript
// ❌ Bad - obvious section dividers
<!-- Header -->
<div>...</div>
<!-- Actions -->
<div>...</div>

// ✅ Good - no comments needed in templates
<div>...</div>
<div>...</div>

// ✅ Good - section dividers in schemas help readability
export const sources = sqliteTable('sources', {
  // Common fields
  label: text('label'),

  // GitHub fields
  repo: text('repo'),
  branch: text('branch'),

  // YouTube fields
  channelId: text('channel_id'),
})

// ✅ Good - comment explains non-obvious logic
// Debounce to avoid rate limiting on rapid keystrokes
const debouncedSearch = useDebounceFn(search, 300)
```

### File Naming

- **Files**: kebab-case (`sandbox-manager.ts`, `sync-source.ts`)
- **Vue components**: PascalCase (`ChatMessage.vue`)
- **Directories**: kebab-case (`api-client/`)

### Caching

**Never use in-memory caches** in serverless environments. Use persistent storage:

```typescript
// ❌ Bad - doesn't work in serverless
const cache = new Map<string, Data>()

// ✅ Good - use persistent storage (KV, Redis, etc.)
const cached = await kv.get<Data>('my-key')
await kv.set('my-key', data, { ttl: 3600 })
```

### Error Handling

Always handle errors gracefully in tools:

```typescript
execute: async ({ query }) => {
  try {
    const results = await searchFiles(query)
    return { success: true, files: results }
  } catch (error) {
    return { success: false, error: error.message, files: [] }
  }
}
```

### Logging

Use structured logging with context:

```typescript
log('info', 'sandbox', `Created: ${sandboxId}`)
log('warn', 'sync', `Source ${sourceId} failed: ${error.message}`)
```

## Environment Variables

### API (`apps/api`)

```bash
# Required
GITHUB_TOKEN=ghp_...              # GitHub token for repo access
GITHUB_SNAPSHOT_REPO=org/repo     # Snapshot repository

# Optional
SAVOIR_SECRET_KEY=...             # API authentication key
SANDBOX_TIMEOUT=600000            # Sandbox timeout in ms (default: 10min)
KV_TTL=1800                       # KV cache TTL in seconds (default: 30min)
```

### SDK (`@savoir/sdk`)

```bash
SAVOIR_API_KEY=...                # API key for authentication
SAVOIR_API_URL=https://...        # API base URL
```

## Testing

- **Framework**: Vitest
- **Run tests**: `pnpm test` at root
- **Test location**: `test/` directory in each package/app

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @savoir/sdk test

# Watch mode
pnpm --filter @savoir/sdk test:watch
```

## Commands

```bash
# Development
pnpm install          # Install all dependencies
pnpm dev              # Start all apps in dev mode
pnpm dev:api          # Start API only
pnpm build            # Build all packages and apps

# Linting & Testing
pnpm lint             # Lint all packages
pnpm lint:fix         # Fix linting issues
pnpm test             # Run tests
pnpm typecheck        # Type check all packages

# Content Sync
pnpm sync             # Trigger content synchronization
pnpm sync:source      # Sync specific source
```
