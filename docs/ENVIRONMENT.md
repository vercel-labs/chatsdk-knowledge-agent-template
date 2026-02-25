# Environment Variables

> Back to [README](../README.md) | See also: [Architecture](./ARCHITECTURE.md), [Customization](./CUSTOMIZATION.md)

Copy the example file and fill in the values:

```bash
cp apps/app/.env.example apps/app/.env
```

## Quick Start (minimum required)

| Variable | How to get it |
|----------|---------------|
| `BETTER_AUTH_SECRET` | Run `openssl rand -hex 32` in your terminal |
| `GITHUB_CLIENT_ID` | From your [GitHub App settings](https://github.com/settings/apps) → Client ID |
| `GITHUB_CLIENT_SECRET` | From your [GitHub App settings](https://github.com/settings/apps) → Generate a client secret |

These three variables are all you need to deploy to Vercel. For **local development**, you also need `AI_GATEWAY_API_KEY` (see [AI](#ai) below). Everything else is optional.

## Authentication

### `BETTER_AUTH_SECRET` (required)

Random secret used by [Better Auth](https://www.better-auth.com/docs/installation#set-environment-variables) to sign sessions and tokens. Generate one with:

```bash
openssl rand -hex 32
```

### `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` (required)

GitHub OAuth credentials for user login. You need a **GitHub App** (not an OAuth App) — the same app can also power the GitHub bot later.

1. Go to [**GitHub Settings → Developer settings → GitHub Apps → New GitHub App**](https://github.com/settings/apps/new)
2. Fill in:
   - **App name**: your bot name (e.g. `my-agent`)
   - **Homepage URL**: your instance URL (or `http://localhost:3000` for dev)
   - **Callback URL**: `<your-url>/api/auth/callback/github`
3. Under **Account permissions**, set **Email addresses** → Read-only
4. Create the app, then from the app settings page:
   - Copy the **Client ID** → `GITHUB_CLIENT_ID`
   - Click **Generate a new client secret** → `GITHUB_CLIENT_SECRET`

> See the [Getting Started guide](https://github.com/vercel-labs/knowledge-agent-template/blob/main/apps/app/app/content/docs/getting-started.md#github-app-setup) for the full GitHub App setup with bot permissions.

### `NUXT_SESSION_PASSWORD` (optional)

Session encryption password. Auto-generated if not set.

## AI

### `AI_GATEWAY_API_KEY` (optional — required for local dev only)

API key for [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) (used by `@ai-sdk/gateway` to route to any AI model).

On **Vercel deployments**, this is not needed — the project automatically authenticates via the platform's OIDC token. You only need to set this for **local development**.

1. Go to the [Vercel AI dashboard](https://vercel.com/~/ai)
2. Create a new Gateway (or use an existing one)
3. Copy the API key → `AI_GATEWAY_API_KEY`

## Sandbox & Sync

These control how the app syncs knowledge sources into the sandbox. All are optional — you can configure them later from the admin UI.

| Variable | Default | Description |
|----------|---------|-------------|
| `NUXT_GITHUB_SNAPSHOT_REPO` | — | Snapshot repository in `owner/repo` format. Configurable from admin UI. |
| `NUXT_GITHUB_SNAPSHOT_BRANCH` | `main` | Branch to use for snapshots |
| `NUXT_GITHUB_TOKEN` | — | Fallback PAT for git operations. Only needed if GitHub App tokens are unavailable. |

## GitHub Bot (optional)

To enable the GitHub bot that responds to mentions in issues, add these from your [GitHub App settings page](https://github.com/settings/apps):

| Variable | Where to find it |
|----------|-----------------|
| `NUXT_PUBLIC_GITHUB_APP_NAME` | Your GitHub App name (e.g. `my-agent`) |
| `NUXT_PUBLIC_GITHUB_BOT_TRIGGER` | Override mention trigger (defaults to app name) |
| `NUXT_GITHUB_APP_ID` | App settings → **App ID** |
| `NUXT_GITHUB_APP_PRIVATE_KEY` | App settings → **Generate a private key** (PEM format, can be base64-encoded) |
| `NUXT_GITHUB_WEBHOOK_SECRET` | The secret you set when creating the app's webhook |

The webhook URL should be `<your-url>/api/webhooks/github`. Subscribe to **Issues** and **Issue comments** events.

### Required GitHub App permissions for the bot

| Permission | Access | Why |
|------------|--------|-----|
| Issues | Read & Write | Read issues and post replies |
| Metadata | Read-only | Required by GitHub for all apps |
| Contents | Read & Write | Push synced content (if using snapshot management) |
| Administration | Read & Write | Auto-create snapshot repos (optional, needs org approval) |

## Discord Bot (optional)

To add a Discord bot, create an app in the [Discord Developer Portal](https://discord.com/developers/applications):

| Variable | Where to find it |
|----------|-----------------|
| `NUXT_DISCORD_BOT_TOKEN` | Bot → **Reset Token** → copy |
| `NUXT_DISCORD_PUBLIC_KEY` | General Information → **Public Key** |
| `NUXT_DISCORD_APPLICATION_ID` | General Information → **Application ID** |
| `NUXT_DISCORD_MENTION_ROLE_IDS` | Comma-separated role IDs that can trigger the bot (optional) |

Set the interactions endpoint URL to `<your-url>/api/webhooks/discord`.

## YouTube (optional)

### `NUXT_YOUTUBE_API_KEY`

Required only if syncing YouTube sources (video transcripts).

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a project (or select an existing one)
3. Enable the [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the key → `NUXT_YOUTUBE_API_KEY`

## Storage (optional)

### `BLOB_READ_WRITE_TOKEN`

[Vercel Blob](https://vercel.com/docs/storage/vercel-blob) token for file uploads. Auto-injected in Vercel deployments.

To get one manually: [Vercel Dashboard](https://vercel.com) → your project → **Storage** → **Blob** → **Connect** → copy the token.

## State (optional)

### `REDIS_URL`

Redis connection URL for bot state persistence (tracks which threads the bot is subscribed to). Falls back to in-memory state if not set — fine for development, but state is lost on restart.

Any Redis-compatible provider works: [Upstash](https://upstash.com), [Redis Cloud](https://redis.io/cloud), etc.

### `VERCEL_OIDC_TOKEN`

Auto-injected in Vercel deployments. No action needed.

## SDK (`@savoir/sdk`)

When using the SDK from an external application:

| Variable | Description |
|----------|-------------|
| `SAVOIR_API_URL` | Base URL of your deployed instance (e.g. `https://your-app.vercel.app`) |
| `SAVOIR_API_KEY` | API key generated from the admin panel at `/admin/api-keys` |

## Database

Migrations run automatically when the application starts — no manual step needed.

```bash
# Generate new migrations after schema changes
bun run db:generate
```
