# Add Source

Guide for adding a new knowledge source to the Knowledge Agent Template instance.

## Via Admin UI (recommended)

1. Navigate to `/admin`
2. Click **Add source**
3. Fill in the fields:

### GitHub Source

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier (e.g. `my-docs`) |
| `label` | Yes | Display name (e.g. `My Docs`) |
| `repo` | Yes | GitHub repository in `owner/repo` format |
| `branch` | No | Branch to fetch (default: `main`) |
| `contentPath` | No | Path to content directory (default: `docs`) |
| `outputPath` | No | Output directory in snapshot (default: `id`) |
| `readmeOnly` | No | Only fetch README.md (default: `false`) |

### File Source

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier |
| `label` | Yes | Display name |
| `outputPath` | No | Output directory in snapshot (default: `id`) |

Upload `.md`, `.mdx`, `.txt`, `.yml`, `.yaml`, or `.json` files when creating the source.

4. Click **Sync** to pull content into the knowledge base

## Via API

```bash
# Create a GitHub source
curl -X POST <your-url>/api/sources \
  -H "Authorization: Bearer <admin-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-docs",
    "type": "github",
    "label": "My Docs",
    "repo": "org/docs-repo",
    "contentPath": "docs"
  }'

# Trigger sync
curl -X POST <your-url>/api/sync \
  -H "Authorization: Bearer <admin-api-key>"
```

## Notes

- After adding sources, always trigger a **sync** to pull content
- Sources are stored in PostgreSQL and can be managed from the admin UI at any time
