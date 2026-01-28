# Content Sources

Savoir aggregates documentation from multiple sources into a unified, searchable knowledge base.

## Database Storage

Sources are stored in SQLite via NuxtHub. The schema:

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

## Configuration File

Sources can be defined in `savoir.config.ts` at the project root:

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

## Source Types

### GitHub Sources

Fetches Markdown documentation from GitHub repositories.

```typescript
{
  id: string           // Unique identifier
  label?: string       // Display name (defaults to capitalized id)
  repo: string         // GitHub repository (owner/repo)
  branch?: string      // Branch to fetch from (default: 'main')
  contentPath?: string // Path to content directory (default: 'docs')
  outputPath?: string  // Output directory in snapshot (default: id)
  readmeOnly?: boolean // Only fetch README.md (default: false)
}
```

**Examples:**

```typescript
// Full documentation tree
{ id: 'nuxt', repo: 'nuxt/nuxt', contentPath: 'docs' }

// Specific branch
{ id: 'nitro', repo: 'nitrojs/nitro', branch: 'v3' }

// README only
{ id: 'ofetch', repo: 'unjs/ofetch', readmeOnly: true }
```

### YouTube Sources

Fetches video transcripts from YouTube channels.

```typescript
{
  id: string           // Unique identifier
  label?: string       // Display name
  channelId: string    // YouTube channel ID
  handle?: string      // YouTube handle (e.g., '@TheAlexLichter')
  maxVideos?: number   // Maximum videos to fetch (default: 50)
}
```

## Managing Sources via API

### List Sources

```bash
curl http://localhost:3000/api/sources
```

### Create Source

```bash
curl -X POST http://localhost:3000/api/sources \
  -H "Content-Type: application/json" \
  -d '{
    "id": "vue",
    "type": "github",
    "label": "Vue.js",
    "repo": "vuejs/core",
    "branch": "main",
    "contentPath": "docs"
  }'
```

### Update Source

```bash
curl -X PUT http://localhost:3000/api/sources/vue \
  -H "Content-Type: application/json" \
  -d '{"branch": "v4"}'
```

### Delete Source

```bash
curl -X DELETE http://localhost:3000/api/sources/vue
```

## Syncing

### Via API

```bash
# Sync all sources
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer $SAVOIR_SECRET_KEY"

# Sync specific source
curl -X POST http://localhost:3000/api/sync/nuxt \
  -H "Authorization: Bearer $SAVOIR_SECRET_KEY"
```

### Sync Tracking

The system tracks when sources were last synced:

- `lastSyncAt` timestamp is stored in KV after each successful sync
- `GET /api/sources` returns the `lastSyncAt` value
- Admin UI (`/admin`) shows a reminder if the last sync was more than 7 days ago

This helps ensure documentation stays up-to-date by providing visibility into sync freshness.

## Content Normalization

All content is normalized to Markdown:

| Input | Output |
|-------|--------|
| `.md` | Preserved as-is |
| `.mdx` | Converted to `.md` |
| `.yml`/`.yaml` | Preserved |
| `.json` | Preserved |
| Other | Ignored |

### Excluded Files

- Lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, etc.)
- `node_modules/`
- Binary files

## Snapshot Repository

The snapshot repository contains all aggregated content:

```
{GITHUB_SNAPSHOT_REPO}/
├── docs/
│   ├── nuxt/
│   │   ├── getting-started/
│   │   └── composables/
│   ├── nitro/
│   └── ...
└── youtube/
    └── alex-lichter/
```

Configure via environment variable:

```bash
GITHUB_SNAPSHOT_REPO=my-org/content-snapshot
```
