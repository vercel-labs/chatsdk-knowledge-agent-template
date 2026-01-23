# Savoir

## Project Overview

Savoir is a platform for building AI agents with access to real-time knowledge bases. It provides:

- **Chat App** (`apps/chat`): A unified Nuxt application that includes both the user-facing chat interface and the API for sandbox management and content synchronization
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
│   ├── chat/                 # Unified Nuxt application (chat + API)
│   │   ├── server/
│   │   │   ├── api/          # API endpoints
│   │   │   │   ├── sandbox/  # Sandbox management endpoints
│   │   │   │   ├── sync/     # Content sync endpoints
│   │   │   │   └── sources/  # Sources CRUD
│   │   │   ├── lib/
│   │   │   │   └── sandbox/  # Sandbox manager
│   │   │   ├── workflows/    # Vercel Workflows
│   │   │   │   ├── sync-docs/
│   │   │   │   └── create-snapshot/
│   │   │   ├── tasks/        # Nitro tasks (seed-sources)
│   │   │   ├── middleware/   # API auth middleware
│   │   │   └── db/           # Drizzle schema
│   │   ├── app/              # Nuxt app (Vue components, pages)
│   │   └── nuxt.config.ts
│   └── github-bot/           # Example GitHub bot
├── packages/
│   ├── sdk/                  # @savoir/sdk - AI SDK tools
│   │   └── src/
│   │       ├── index.ts      # createSavoir() export
│   │       ├── client.ts     # API client
│   │       └── tools/        # AI SDK tool definitions
│   └── logger/               # @savoir/logger - Logging utilities
├── savoir.config.ts          # Source definitions (for seeding DB)
└── docs/                     # Architecture documentation
```

### Data Flow

```
┌──────────────┐     ┌─────────────┐     ┌──────────────────┐
│  AI Agent    │────▶│ @savoir/sdk │────▶│   apps/chat      │
│  (Your App)  │     │   (tools)   │     │   (Nuxt API)     │
└──────────────┘     └─────────────┘     └────────┬─────────┘
                                                  │
                           ┌──────────────────────┼──────────────────────┐
                           │                      │                      │
                           ▼                      ▼                      ▼
                    ┌────────────┐        ┌────────────┐        ┌────────────┐
                    │  Sandbox   │        │  Vercel    │        │  NuxtHub   │
                    │  Manager   │        │  Workflow  │        │   (DB/KV)  │
                    └─────┬──────┘        └─────┬──────┘        └────────────┘
                          │                     │
                          ▼                     ▼
                    ┌────────────┐        ┌────────────┐
                    │   Vercel   │        │   GitHub   │
                    │   Sandbox  │        │   Repo     │
                    └────────────┘        └────────────┘
```

### Key Components

#### Sandbox Manager (`server/lib/sandbox/`)

Manages Vercel Sandbox lifecycle:

- **Create**: Clones snapshot repo into new sandbox
- **Recover**: Reuses existing sandbox by ID (stored in KV)
- **Extend**: Extends sandbox timeout when running low
- **Execute**: Runs shell commands (grep, cat, find) for search/read

#### Content Sync (`server/workflows/sync-docs/`)

Aggregates documentation from multiple sources using Vercel Workflows:

- Reads sources from database (via Drizzle)
- Fetches from GitHub repositories (docs, READMEs)
- Normalizes to Markdown format
- Creates snapshot for instant sandbox startup

#### Sources Database

Sources are stored in SQLite (via NuxtHub):

```typescript
export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['github', 'youtube'] }).notNull(),

  // Common fields
  label: text('label').notNull(),

  // GitHub fields
  repo: text('repo'),
  branch: text('branch'),
  contentPath: text('content_path'),
  outputPath: text('output_path'),
  readmeOnly: integer('readme_only', { mode: 'boolean' }),

  // YouTube fields
  channelId: text('channel_id'),
  handle: text('handle'),
  maxVideos: integer('max_videos'),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})
```

#### SDK Tools

AI SDK-compatible tools:

- `searchAndRead`: Combined search + read (most efficient)
- `search`: Search for file paths matching query
- `read`: Read specific files by path

## API Endpoints

### Sandbox Management

```
POST /api/sandbox/snapshot
  Creates a new snapshot from the snapshot repo

POST /api/sandbox/search-and-read
  Body: { query: string, limit?: number, sessionId?: string }
  Returns: { sessionId: string, matches: [...], files: [...] }

POST /api/sandbox/read
  Body: { paths: string[], sessionId?: string }
  Returns: { sessionId: string, files: [...] }
```

### Content Sync

```
POST /api/sync
  Triggers full content synchronization

POST /api/sync/:source
  Triggers sync for specific source
```

### Sources CRUD

```
GET /api/sources
  Returns list of sources grouped by type

POST /api/sources
  Creates a new source

PUT /api/sources/:id
  Updates a source

DELETE /api/sources/:id
  Deletes a source
```

## SDK Usage

```typescript
import { createSavoir } from '@savoir/sdk'
import { generateText } from 'ai'

// Initialize client
const savoir = createSavoir({
  apiKey: process.env.SAVOIR_API_KEY,
  apiUrl: 'https://your-app.nuxt.dev'
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

### Nuxt UI

Always use Nuxt UI components and semantic color classes:

```html
<!-- ❌ Bad - native elements -->
<button class="...">Click</button>
<input class="..." />

<!-- ✅ Good - Nuxt UI components -->
<UButton>Click</UButton>
<UInput />

<!-- ❌ Bad - manual light/dark -->
<div class="bg-neutral-100 dark:bg-neutral-800">

<!-- ✅ Good - semantic classes (with optional opacity) -->
<div class="bg-muted">
<div class="bg-muted/50">
<div class="bg-elevated">
<div class="bg-default">
<div class="text-muted">
<div class="text-muted/60">
<div class="text-highlighted">
<div class="border-default">
```

### Nuxt Auto-imports

Nuxt auto-imports from these directories - no `import` statements needed:

| Directory | Available in | Example |
|-----------|--------------|---------|
| `app/composables/` | Client | `useChat()`, `useMarkdown()` |
| `app/components/` | Client | `<SourceCard />`, `<ChatMessage />` |
| `server/utils/` | Server | `requireAuth()`, `generateTitle()` |
| `shared/utils/` | Both | Shared utilities |
| `shared/types/` | Both | Via `#shared/types` |

```typescript
// ❌ Bad - unnecessary import
import { useChat } from '~/composables/useChat'
import type { ChatMessage } from '~~/shared/types/Chat'

const chat = useChat()
const message: ChatMessage = {
  id: '1',
  content: 'Hello, world!',
  role: 'user',
  createdAt: new Date(),
}

// ✅ Good - auto-imported
const chat = useChat()
const message: ChatMessage = {
  id: '1',
  content: 'Hello, world!',
  role: 'user',
  createdAt: new Date(),
}
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

// ✅ Good - use NuxtHub KV
const kv = hubKV()
const cached = await kv.get<Data>('my-key')
await kv.set('my-key', data)
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

Use `@savoir/logger` for all logging. Two patterns:

**1. Simple logs** - general purpose logging everywhere:

```typescript
import { getLogger } from '@savoir/logger'

const logger = getLogger()

logger.log('sync', 'Syncing 3 sources...')
logger.log('sync', 'nuxt-icon: 12 files in 31ms')
logger.log('sandbox', `Created: ${sandboxId}`)
logger.log('chat', `[${requestId}] Starting agent with ${model}`)
```

**2. Wide events** - for request logging (one event per request):

```typescript
import { getLogger } from '@savoir/logger'

const logger = getLogger()

export default defineEventHandler(async (event) => {
  const log = logger.request({
    method: event.method,
    path: event.path,
  })

  try {
    const user = await getUser(event)
    log.set({ userId: user.id, plan: user.plan })

    const result = await doWork()
    log.set({ itemCount: result.items.length })

    return result
  } catch (error) {
    log.error(error)
    throw error
  } finally {
    log.emit()
  }
})
```

**Key principles:**
- One wide event per request (emitted in `finally`)
- Add context progressively with `log.set()`
- Record errors with `log.error()` before emit
- Include business context (user plan, item count, etc.)

## Code Quality Best Practices

### Comment Best Practices

Write **short, clear JSDoc** that explains what functions do, not why they exist.

**Good comments:**
- Focus on behavior and return values
- Explain non-obvious implementation choices
- Are concise (1 line preferred, 2-3 max)
- Use imperative mood: "Returns X if Y"

**Examples:**
```typescript
/** Returns session if exists and not expired, null otherwise */
export async function getSession(sessionId: string): Promise<SandboxSession | null>

/** Creates sandbox from repository and takes snapshot */
export async function stepCreateAndSnapshot(config: SnapshotConfig)

// Inline comment for non-obvious choice:
// Use grep instead of ripgrep (more widely available in sandboxes)
const result = await sandbox.runCommand({ cmd: 'grep', ... })
```

**Avoid:**
- Repeating the function name: `/** Get session */`
- Explaining conversation context: `/** Note: Done in single step to avoid serialization */`
- Multi-line JSDoc for simple functions
- Comments on interfaces (type names are self-documenting)

### Logging Best Practices

Use `@savoir/logger` for structured logging with context.

#### Logger Features

**Simple logs** for workflow progress:
```typescript
import { getLogger } from '@savoir/logger'
const logger = getLogger()

logger.log('sandbox', `Created: ${sandboxId}`)
logger.log('sync', `${sourceId}: synced ${fileCount} files`)
```

**Wide events** for request logging:
```typescript
const log = logger.request({ method: 'POST', path: '/api/sync' })
log.set({ userId, sourceCount: sources.length })
// ... do work ...
log.emit() // Emits with duration, context, and optional error
```

**Structured errors** with context:
```typescript
import { createError } from '@savoir/logger'

throw createError({
  message: 'Failed to sync repository',
  why: 'GitHub API rate limit exceeded',
  fix: 'Wait 1 hour or use a different token',
  link: 'https://docs.github.com/en/rest/rate-limit',
  cause: originalError,
})
```

#### What to Log

**Good logs include:**
- Unique identifiers (`sandboxId`, `sessionId`, `userId`)
- Quantifiable metrics (`count`, `fileCount`, `successCount`)
- Final summaries with statistics

**Avoid:**
- Obvious steps: `logger.log('sync', 'Taking snapshot...')`
- Messages without data: `logger.log('sync', 'No changes to push')`
- Redundant pairs where only the second has data

## Environment Variables

### Chat App (`apps/chat`)

```bash
# Required for sandbox/sync
NUXT_GITHUB_TOKEN=ghp_...              # GitHub token for repo access
NUXT_GITHUB_SNAPSHOT_REPO=org/repo     # Snapshot repository
NUXT_GITHUB_SNAPSHOT_BRANCH=main       # Snapshot branch (default: main)

# Optional
NUXT_SAVOIR_SECRET_KEY=...             # API authentication key for /api/sync and /api/sandbox
```

### SDK (`@savoir/sdk`)

```bash
SAVOIR_API_KEY=...                # API key for authentication
SAVOIR_API_URL=https://...        # API base URL (your deployed chat app)
```

## Database

Sources are stored in SQLite via NuxtHub and can be managed via the API (`/api/sources`).

## Testing

- **Framework**: Vitest
- **Run tests**: `bun run test` at root
- **Test location**: `test/` directory in each package/app

```bash
# Run all tests
bun run test

# Run specific package tests
turbo run test --filter=@savoir/sdk

# Watch mode
turbo run test:watch --filter=@savoir/sdk
```

## Commands

```bash
# Development
bun install           # Install all dependencies
bun run dev           # Start chat app in dev mode
bun run build         # Build all packages and apps

# Database
turbo run db:generate --filter=@savoir/chat  # Generate migrations
turbo run db:migrate --filter=@savoir/chat   # Run migrations

# Workflows
turbo run workflow:web --filter=@savoir/chat # Monitor workflow progress

# Linting & Testing
bun run lint          # Lint all packages
bun run lint:fix      # Fix linting issues
bun run test          # Run tests
bun run typecheck     # Type check all packages
```
