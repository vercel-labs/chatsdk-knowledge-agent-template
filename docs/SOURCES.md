# Content Sources

> Back to [README](../README.md) | See also: [Customization](./CUSTOMIZATION.md), [Architecture](./ARCHITECTURE.md)

Knowledge Agent Template aggregates content from multiple sources into a unified, searchable knowledge base. A source is anything that produces files — GitHub repos, uploaded files, and any custom source you build. Everything ends up as files in a sandbox, and the AI agent searches across all of them.

The system is designed to be extensible. Built-in source types handle GitHub and file uploads, but the architecture supports any source that can output files: Reddit threads, Slack exports, RSS feeds, custom APIs, static markdown — anything.

## Managing Sources

Sources are managed through the **admin interface** at `/admin`. From there you can:

- Add new sources (GitHub repositories, file uploads, or custom types)
- Edit existing source configurations
- Delete sources
- Trigger a sync to update the knowledge base

Sources can also be listed programmatically via the SDK:

```typescript
const sources = await savoir.client.getSources()
```

## Database Storage

Sources are stored in PostgreSQL via NuxtHub. The schema:

```typescript
export const sources = pgTable('sources', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['github', 'file'] }).notNull(),
  label: text('label').notNull(),
  basePath: text('base_path').default('/docs'),

  // GitHub fields
  repo: text('repo'),
  branch: text('branch'),
  contentPath: text('content_path'),
  outputPath: text('output_path'),
  readmeOnly: boolean('readme_only').default(false),

  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})
```

## Source Types

### GitHub Sources

Fetches Markdown documentation from GitHub repositories.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier |
| `label` | `string` | Display name |
| `repo` | `string` | GitHub repository (`owner/repo`) |
| `branch` | `string?` | Branch to fetch from (default: `main`) |
| `contentPath` | `string?` | Path to content directory (default: `docs`) |
| `outputPath` | `string?` | Output directory in snapshot (default: `id`) |
| `basePath` | `string?` | URL base path for this source (default: `/docs`) |
| `readmeOnly` | `boolean?` | Only fetch README.md (default: `false`) |
| `additionalSyncs` | `array?` | Extra repos to sync into the same source |

### File Sources

Uploads documentation files directly (`.md`, `.mdx`, `.txt`, `.yml`, `.yaml`, `.json`).

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier |
| `label` | `string` | Display name |
| `outputPath` | `string?` | Output directory in snapshot (default: `id`) |
| `basePath` | `string?` | URL base path for this source (default: `/files`) |

## Syncing

Content syncing is triggered from the **admin interface**. You can also trigger it programmatically via the SDK:

```typescript
// Sync all sources
await savoir.client.sync()

// Sync a specific source
await savoir.client.syncSource('my-docs')
```

### How Sync Works

1. A [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) is created from the latest snapshot
2. All source repositories are cloned/updated
3. Changes are pushed to the snapshot repository
4. A new sandbox snapshot is taken for instant startup

This runs as a durable [Vercel Workflow](https://useworkflow.dev) with automatic retries. See [Architecture > Sandbox System](./ARCHITECTURE.md#3-sandbox-system) for more details on how snapshots and sandboxes work.

### Sync Tracking

The system tracks when sources were last synced:

- `lastSyncAt` timestamp is stored in KV after each successful sync
- `GET /api/sources` returns the `lastSyncAt` value
- The admin interface shows a reminder if the last sync was more than 7 days ago

## Content Normalization

During sync, only documentation-relevant files are kept in the snapshot. All other files are discarded.

### Supported File Types

| Extension | Handling |
|-----------|----------|
| `.md` | Preserved as-is |
| `.mdx` | Preserved (treated as Markdown) |
| `.yml` / `.yaml` | Preserved |
| `.json` | Preserved |
| All other types | **Deleted** during sync |

Source code files (`.ts`, `.js`, `.vue`, etc.), images, binaries, and any file not in the list above are automatically removed after cloning. Only the supported types end up in the snapshot repository.

### Excluded Directories

- `node_modules/`
- Empty directories (cleaned up after filtering)

## Snapshot Repository

The snapshot repository contains all aggregated content:

```
{NUXT_GITHUB_SNAPSHOT_REPO}/
├── docs/
│   ├── my-framework/
│   │   ├── getting-started/
│   │   └── api/
│   ├── my-library/
│   └── ...
└── files/
    └── my-uploads/
```

Configure via environment variable:

```bash
NUXT_GITHUB_SNAPSHOT_REPO=my-org/content-snapshot
```
