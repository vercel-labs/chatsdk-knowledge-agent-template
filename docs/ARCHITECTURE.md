# Savoir Architecture

This document describes the technical architecture of Savoir, a platform for building AI agents with real-time knowledge access.

## System Overview

Savoir consists of two main components:

1. **Chat App** (`apps/chat`): A unified Nuxt application that provides both the chat interface and the API for sandbox management, content synchronization, and source management
2. **SDK** (`packages/sdk`): A client library providing AI SDK-compatible tools

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          User's AI Application                           │
│                    (Discord bot, GitHub bot, Chat app)                   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  import { generateText } from 'ai'                                 │  │
│  │  import { createSavoir } from '@savoir/sdk'                        │  │
│  │                                                                    │  │
│  │  const savoir = createSavoir({ apiKey, apiUrl })                   │  │
│  │  const { text } = await generateText({                             │  │
│  │    model: 'google/gemini-3-flash',                                 │  │
│  │    tools: { ...savoir.tools }                                      │  │
│  │  })                                                                │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTPS (API Key auth)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            apps/chat                                     │
│                       (Unified Nuxt App)                                 │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ /api/sandbox/*  │  │   /api/sync/*   │  │    /api/sources/*       │  │
│  │                 │  │                 │  │                         │  │
│  │ - snapshot      │  │ - POST /sync    │  │ - GET /sources          │  │
│  │ - search-and-   │  │ - POST /sync/:s │  │ - POST /sources         │  │
│  │   read          │  │                 │  │ - PUT /sources/:id      │  │
│  │ - read          │  │                 │  │ - DELETE /sources/:id   │  │
│  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘  │
│           │                    │                        │               │
│           ▼                    ▼                        ▼               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ Sandbox Manager │  │ Vercel Workflow │  │      NuxtHub DB         │  │
│  │                 │  │                 │  │                         │  │
│  │ - Lifecycle     │  │ - Durable exec  │  │ - SQLite (sources)      │  │
│  │ - KV caching    │  │ - Auto retries  │  │ - KV (sessions)         │  │
│  │ - Command exec  │  │ - Sync sources  │  │ - Blob (uploads)        │  │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────────────┘  │
└───────────┼────────────────────┼────────────────────────────────────────┘
            │                    │
            ▼                    ▼
     ┌────────────┐       ┌────────────┐
     │   Vercel   │       │   GitHub   │
     │   Sandbox  │◄──────│  Snapshot  │
     │   API      │ clone │   Repo     │
     └────────────┘       └────────────┘
```

## Project Structure

```
savoir/
├── savoir.config.ts          # Source definitions (for seeding DB)
├── apps/
│   └── chat/                 # Unified Nuxt application
│       ├── app/              # Vue app (components, pages, composables)
│       ├── server/
│       │   ├── api/          # API routes
│       │   │   ├── sandbox/  # Sandbox endpoints
│       │   │   │   ├── snapshot.post.ts
│       │   │   │   ├── search-and-read.post.ts
│       │   │   │   └── read.post.ts
│       │   │   ├── sync/     # Sync endpoints
│       │   │   │   ├── index.post.ts
│       │   │   │   └── [source].post.ts
│       │   │   └── sources/  # Sources CRUD
│       │   ├── lib/
│       │   │   └── sandbox/  # Sandbox manager library
│       │   │       ├── types.ts          # Type definitions
│       │   │       ├── context.ts        # Sandbox creation
│       │   │       ├── session.ts        # Session management (KV)
│       │   │       ├── snapshot.ts       # Snapshot operations (KV)
│       │   │       ├── manager.ts        # High-level sandbox API
│       │   │       ├── git.ts            # Git operations in sandbox
│       │   │       ├── source-sync.ts    # Content sync helpers
│       │   │       └── index.ts          # Public exports
│       │   ├── workflows/    # Vercel Workflows
│       │   │   ├── sync-docs/
│       │   │   └── create-snapshot/
│       │   ├── tasks/        # Nitro tasks
│       │   │   └── seed-sources.ts
│       │   ├── middleware/   # API auth
│       │   │   └── api-auth.ts
│       │   ├── db/           # Drizzle schema
│       │   │   └── schema.ts
│       │   └── plugins/      # Nitro plugins
│       │       └── logger.ts
│       └── nuxt.config.ts
├── packages/
│   ├── sdk/                  # @savoir/sdk
│   │   └── src/
│   │       ├── index.ts      # Public exports
│   │       ├── client.ts     # HTTP client
│   │       └── tools/        # AI SDK tool definitions
│   └── logger/               # @savoir/logger
└── docs/                     # Documentation
```

## Component Details

### 1. Sources (Database)

Sources are stored in SQLite via NuxtHub. They can be managed via the API or seeded from `savoir.config.ts`.

#### Database Schema

```typescript
export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['github', 'youtube'] }).notNull(),
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

  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})
```

### 2. SDK (`@savoir/sdk`)

The SDK provides AI SDK-compatible tools that communicate with the Savoir API.

#### API Design

```typescript
import { tool } from 'ai'
import { z } from 'zod'

export interface SavoirOptions {
  apiKey: string
  apiUrl: string
  chatId?: string  // Optional: reuse sandbox across calls
}

export interface SavoirClient {
  searchAndRead: ReturnType<typeof tool>  // Search and read files (recommended)
  search: ReturnType<typeof tool>         // Search for files
  read: ReturnType<typeof tool>           // Read specific files
}

export function createSavoir(options: SavoirOptions): SavoirClient
```

### 3. Sandbox System

The sandbox system uses [Vercel Sandbox Snapshots](https://vercel.com/docs/vercel-sandbox/managing#snapshotting) for instant startup without cloning.

#### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Sync Workflow                                    │
│                                                                          │
│  1. Read     ──▶  2. Clone    ──▶  3. Sync     ──▶  4. Git     ──▶     │
│     sources       in sandbox       content          push                │
│     from DB                                                              │
│                                                          │               │
│                                                          ▼               │
│                                                   5. Take snapshot       │
│                                                          │               │
│                                                          ▼               │
│                                                   ┌─────────────┐        │
│                                                   │  Snapshot   │        │
│                                                   │  (7 days)   │        │
│                                                   └──────┬──────┘        │
└──────────────────────────────────────────────────────────┼──────────────┘
                                                           │
                                                           │ instant start
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API Sandbox Endpoints                            │
│                                                                          │
│  Request ──▶ Start from snapshot ──▶ Search/Read ──▶ Return results     │
│                  (instant)              (grep/cat)                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4. Content Sync

Content synchronization uses [Vercel Workflow](https://github.com/vercel/workflow) for durable execution with automatic retries.

```
POST /api/sync
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Vercel Workflow                                  │
│                     (Durable execution engine)                           │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                       stepSyncAll                                 │  │
│  │                                                                   │  │
│  │  1. Create sandbox from snapshot                                 │  │
│  │  2. Sync all sources (GitHub repos, etc.)                        │  │
│  │  3. Git commit and push changes                                  │  │
│  │  4. Take new snapshot                                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Features:                                                               │
│  - Automatic retries on failure                                          │
│  - Progress tracking via `bun run workflow:web`                          │
│  - Durable state (survives server restarts)                              │
│  - All operations in single step (avoids serialization issues)           │
└─────────────────────────────────────────────────────────────────────────┘
```

## API Endpoints

### Authentication

Authentication is optional for `/api/sandbox/*` and `/api/sync/*` endpoints. If `SAVOIR_SECRET_KEY` is configured, these endpoints require an API key:

```
Authorization: Bearer <api-key>
```

If not configured, the API is open (useful for local development).

### Sandbox Endpoints

#### POST /api/sandbox/snapshot

Create a new snapshot from the documentation repository.

**Response:**
```json
{
  "status": "started",
  "message": "Snapshot workflow started."
}
```

#### POST /api/sandbox/search-and-read

Combined search and read operation (recommended).

**Request:**
```json
{
  "query": "useAsyncData",
  "limit": 20,
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "sessionId": "sess_1234567890_abc123",
  "matches": [
    { "path": "docs/nuxt/composables/use-async-data.md", "lineNumber": 10, "content": "..." }
  ],
  "files": [
    { "path": "docs/nuxt/composables/use-async-data.md", "content": "# useAsyncData\n\n..." }
  ]
}
```

#### POST /api/sandbox/read

Read specific files by path.

**Request:**
```json
{
  "paths": ["docs/nuxt/guide/middleware.md"],
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "sessionId": "sess_1234567890_abc123",
  "files": [
    { "path": "docs/nuxt/guide/middleware.md", "content": "# Middleware\n\n..." }
  ]
}
```

### Sync Endpoints

#### POST /api/sync

Sync all sources.

**Response:**
```json
{
  "status": "started",
  "message": "Sync workflow started."
}
```

#### POST /api/sync/:source

Sync a specific source.

**Response:**
```json
{
  "status": "started",
  "message": "Sync workflow started for source \"nuxt\".",
  "source": "nuxt"
}
```

### Sources Endpoints

#### GET /api/sources

List all sources grouped by type.

**Response:**
```json
{
  "github": [...],
  "youtube": [...]
}
```

## Storage Strategy

### NuxtHub SQLite

Used for persistent data:

```typescript
// Sources table
sources: { id, type, label, repo, branch, ... }

// Users, chats, messages tables for chat app
```

### NuxtHub KV

Used for caching and session management:

```typescript
// Current snapshot (updated by sync workflow)
`snapshot:current` -> { snapshotId: string, createdAt: number }

// Active sandbox sessions
`session:${sessionId}` -> { sandboxId: string, snapshotId: string, ... }
```

### Snapshot Repository

Structure:

```
{GITHUB_SNAPSHOT_REPO}/
├── docs/
│   ├── nuxt/
│   │   ├── getting-started/
│   │   │   └── installation.md
│   │   └── composables/
│   │       └── use-async-data.md
│   ├── nitro/
│   └── ...
└── youtube/
    └── alex-lichter/
        └── nuxt-4-overview-TAoTh4DqH6A.md
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NUXT_GITHUB_TOKEN` | Yes | GitHub token for API access |
| `NUXT_GITHUB_SNAPSHOT_REPO` | Yes | Snapshot repository (owner/repo) |
| `NUXT_GITHUB_SNAPSHOT_BRANCH` | No | Branch to use (default: main) |
| `NUXT_SAVOIR_SECRET_KEY` | No | API key for authentication |

## Security

### API Key Validation (Optional)

Authentication is **optional** and only enforced if `NUXT_SAVOIR_SECRET_KEY` is set.

- If `NUXT_SAVOIR_SECRET_KEY` is not set → API is open (useful for development)
- If `NUXT_SAVOIR_SECRET_KEY` is set → `/api/sync/*` and `/api/sandbox/*` require `Authorization: Bearer <key>`

```typescript
// apps/chat/server/middleware/api-auth.ts
export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/sync') && !path.startsWith('/api/sandbox')) {
    return
  }

  const config = useRuntimeConfig()
  if (!config.savoirSecretKey) return

  const authHeader = getHeader(event, 'Authorization')
  const apiKey = authHeader?.replace('Bearer ', '')

  if (apiKey !== config.savoirSecretKey) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
})
```

### Sandbox Isolation

- Each sandbox runs in isolated Vercel environment
- No network access from within sandbox
- Read-only filesystem (cloned repo)
- Commands limited to grep, cat, find, ls
