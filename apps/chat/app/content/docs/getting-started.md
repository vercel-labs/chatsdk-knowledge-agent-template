# Getting Started

## Environment Variables

Create a `.env` file in the `apps/chat/` directory. You can copy `.env.example` as a starting point:

```bash
cp apps/chat/.env.example apps/chat/.env
```

### Required

| Variable | Description |
|----------|-------------|
| `BETTER_AUTH_SECRET` | Secret used to sign sessions and tokens. See [Better Auth docs](https://www.better-auth.com/docs/installation#set-environment-variables). |
| `GITHUB_CLIENT_ID` | GitHub App client ID (used for OAuth login). See [GitHub App Setup](#github-app-setup) below. |
| `GITHUB_CLIENT_SECRET` | GitHub App client secret |
| `NUXT_ADMIN_USERS` | Comma-separated list of admin emails or GitHub usernames |
| `NUXT_PUBLIC_SITE_URL` | Public URL of your Savoir instance |
| `AI_GATEWAY_API_KEY` | [Vercel AI Gateway](https://ai-sdk.dev) API key |

`NUXT_GITHUB_SNAPSHOT_REPO` and `NUXT_GITHUB_TOKEN` are optional. You can configure the snapshot repository in the admin sandbox UI after startup, and Savoir uses a GitHub App installation access token automatically when app credentials are configured.

`NUXT_GITHUB_TOKEN` is only a fallback. Keep it unset unless you explicitly need to override GitHub App authentication.

### Optional (for bots)

| Variable | Description |
|----------|-------------|
| `NUXT_PUBLIC_GITHUB_APP_NAME` | GitHub App name (e.g. `your-bot-name`) |
| `NUXT_GITHUB_APP_ID` | GitHub App ID (same app as OAuth, see [GitHub App Setup](#github-app-setup)) |
| `NUXT_GITHUB_APP_PRIVATE_KEY` | GitHub App private key (PEM format) |
| `NUXT_GITHUB_WEBHOOK_SECRET` | Webhook secret for the GitHub App |
| `NUXT_DISCORD_BOT_TOKEN` | Discord bot token. See [Discord Bot Setup](/admin/docs/discord-bot). |
| `NUXT_DISCORD_PUBLIC_KEY` | Discord application public key |
| `NUXT_DISCORD_APPLICATION_ID` | Discord application ID |
| `NUXT_YOUTUBE_API_KEY` | [YouTube Data API](https://developers.google.com/youtube/v3) key (for syncing YouTube sources) |

## GitHub App Setup

Savoir uses a single **GitHub App** for both **user authentication** (OAuth login) and the **GitHub bot** (webhook events). This avoids creating two separate apps.

1. Go to [**GitHub Settings > Developer settings > GitHub Apps > New GitHub App**](https://github.com/settings/apps/new)
2. Fill in the basic information:
   - **App name**: e.g. `your-bot-name`
   - **Homepage URL**: your Savoir instance URL
   - **Callback URL**: `<your-url>/api/auth/callback/github` (for OAuth login)
   - **Webhook URL**: `<your-url>/api/webhooks/github` (for the bot)
   - **Webhook secret**: generate a random string and save it

### Account Permissions

| Permission | Access | Why |
|------------|--------|-----|
| Email addresses | Read-only | Required for user login -- allows Savoir to identify users by email |

### Repository Permissions

| Permission | Access | Why |
|------------|--------|-----|
| Issues | Read & Write | Bot needs to read issues and post replies |
| Metadata | Read-only | Required by GitHub for all apps |

If you want Savoir to manage the snapshot repository automatically from the admin UI (list repos, create repo if missing, write sync commits), add:

| Permission | Access | Why |
|------------|--------|-----|
| Contents | Read & Write | Push synced content and maintain the Savoir marker file |
| Administration | Read & Write* | Needed when creating repositories automatically |

\* Depending on your GitHub setup (user vs org ownership), repository creation can require elevated app permissions and org approval.

### Events

Subscribe to these webhook events:

- **Issues** -- triggers auto-reply on new issues (optional)
- **Issue comments** -- triggers the bot when mentioned in a comment

### After Creation

From the app settings page, collect:

| Value | Maps to |
|-------|---------|
| **App ID** | `NUXT_GITHUB_APP_ID` |
| **Client ID** | `GITHUB_CLIENT_ID` |
| **Client secret** (generate one) | `GITHUB_CLIENT_SECRET` |
| **Private key** (generate one) | `NUXT_GITHUB_APP_PRIVATE_KEY` |
| **Webhook secret** | `NUXT_GITHUB_WEBHOOK_SECRET` |

> **Important:** Make the GitHub App **public** so users can install it on organizations. While the app is private, the org picker won't appear and installations are limited to your personal account only. You can do this from the app's **Danger Zone** at the bottom of its settings page.

Then install the app on the repositories where you want the bot to be active: **Install App** tab > select your repositories.

For automatic snapshot repository management, make sure the app is installed on the target owner (user/org) with the updated permissions above.

For more details on the bot behavior, see the [GitHub Bot documentation](/admin/docs/github-bot).

## First Launch

Install dependencies:

::code-group
```bash [bun]
bun install
```
```bash [pnpm]
pnpm install
```
```bash [yarn]
yarn install
```
```bash [npm]
npm install
```
::

Start the development server:

::code-group
```bash [bun]
bun run dev
```
```bash [pnpm]
pnpm dev
```
```bash [yarn]
yarn dev
```
```bash [npm]
npm run dev
```
::

The app will be available at `http://localhost:3000`. Sign in with GitHub using one of the admin emails or usernames defined in `NUXT_ADMIN_USERS` to access the admin panel.

## Adding Sources

Sources define the knowledge base the app uses to answer questions. They are managed through the **admin interface**. Sources aren't limited to documentation — you can add any content that produces files (GitHub repos, YouTube transcripts, custom APIs). See the [Sources documentation](https://github.com/vercel-labs/savoir/blob/main/docs/SOURCES.md) for all available options.

1. Navigate to the admin panel at `/admin`
2. Go to the Sources section
3. Click **Add source** and configure it (GitHub repository or YouTube channel)
4. Click **Sync** to pull the content into the knowledge base

## Syncing Content

After adding or updating sources, trigger a sync from the admin interface. The sync process runs as a durable [Vercel Workflow](https://useworkflow.dev) with automatic retries:

1. Creates a [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) from the latest snapshot
2. Clones/updates all source repositories
3. Pushes changes to the snapshot repository
4. Takes a new sandbox snapshot for instant startup

## How It Works

Savoir uses a **file-based search** approach -- no embeddings or vector databases:

1. Documentation from all sources is aggregated into a single snapshot repository
2. When a user asks a question, a [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) is created from the snapshot
3. The AI agent uses `bash` and `bash_batch` tools (via the [AI SDK](https://ai-sdk.dev)) to run `grep`, `find`, `cat`, etc. in the sandbox
4. Results are synthesized into a natural language answer with citations

You can also integrate Savoir into your own applications using the [SDK](/admin/docs/sdk). For the full technical architecture, see the [Architecture documentation](https://github.com/vercel-labs/savoir/blob/main/docs/ARCHITECTURE.md) on GitHub.

## Admin Panel

The admin panel at `/admin` provides:

- **Sources** (`/admin`): Manage knowledge base sources (GitHub repos, YouTube channels)
- **Agent Configuration** (`/admin/agent`): Customize the AI agent's behavior (response style, model, temperature, citations, etc.)
- **Sandbox** (`/admin/sandbox`): Snapshot status and sync controls
- **Stats** (`/admin/stats`): Usage statistics and analytics
- **API Keys** (`/admin/api-keys`): Manage API keys for external integrations. See [API Keys documentation](/admin/docs/api-keys).

## Tech Stack

Savoir is built on:

- [Nuxt](https://nuxt.com) -- full-stack Vue framework
- [NuxtHub](https://hub.nuxt.com) -- database (SQLite), KV storage, and blob storage
- [Vercel AI SDK](https://ai-sdk.dev) -- AI model integration and tool system
- [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox) -- isolated execution environment
- [Vercel Workflow](https://useworkflow.dev) -- durable workflow execution for content sync
- [Better Auth](https://www.better-auth.com) -- authentication (email/password, GitHub OAuth, API keys)
- [Drizzle ORM](https://orm.drizzle.team) -- type-safe database queries
