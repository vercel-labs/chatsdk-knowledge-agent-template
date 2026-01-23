# Environment Variables

## Chat App (`apps/chat`)

```bash
# Required for sandbox/sync
NUXT_GITHUB_TOKEN=ghp_...              # GitHub token for repo access
NUXT_GITHUB_SNAPSHOT_REPO=org/repo     # Snapshot repository
NUXT_GITHUB_SNAPSHOT_BRANCH=main       # Snapshot branch (default: main)

# Optional
NUXT_SAVOIR_SECRET_KEY=...             # API authentication key
```

## SDK (`@savoir/sdk`)

```bash
SAVOIR_API_KEY=...         # API key for authentication
SAVOIR_API_URL=https://... # API base URL (your deployed chat app)
```

## Database Commands

```bash
# Generate migrations
turbo run db:generate --filter=@savoir/chat

# Run migrations
turbo run db:migrate --filter=@savoir/chat
```

## Workflows

```bash
# Monitor workflow progress
turbo run workflow:web --filter=@savoir/chat
```
