# GitHub Bot Setup

The Knowledge Agent Template GitHub bot responds to mentions in GitHub issues, using your knowledge base to provide answers directly in the conversation.

> If you haven't created your GitHub App yet, follow the [GitHub App Setup](/admin/docs/getting-started#github-app-setup) in the Getting Started guide first. The same app handles both OAuth login and the bot.

## Prerequisites

> **Important:** Make sure your GitHub App is **public**. While it's private, the org picker won't appear during installation and users can only install it on their personal account. Set it to public from the **Danger Zone** at the bottom of the app's settings page.

Make sure your GitHub App is configured with:

- **Webhook URL** pointing to `<your-url>/api/webhooks/github`
- **Webhook secret** set and matching your `NUXT_GITHUB_WEBHOOK_SECRET`
- **Repository permissions**: Issues (Read & Write), Metadata (Read-only)
- **Events**: Issues, Issue comments

For the full setup, see [Getting Started > GitHub App Setup](/admin/docs/getting-started#github-app-setup).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NUXT_PUBLIC_GITHUB_APP_NAME` | The GitHub App name (e.g. `your-bot-name`). Used to build the install URL and as the default bot username. |
| `NUXT_PUBLIC_GITHUB_BOT_TRIGGER` | Optional override for the bot mention trigger. Defaults to the app name. |
| `NUXT_GITHUB_APP_ID` | The App ID from your [GitHub App settings](https://github.com/settings/apps) |
| `NUXT_GITHUB_APP_PRIVATE_KEY` | The private key (PEM format). Generate one from your app's settings page. Can be base64-encoded. |
| `NUXT_GITHUB_WEBHOOK_SECRET` | The webhook secret you set when creating the app |

## Install the App

1. From your [GitHub App settings](https://github.com/settings/apps), click **Install App**
2. Select the repositories where the bot should be active
3. Confirm the installation

Users can also install the app from the sidebar suggestion card or from the **Settings > Integrations** page.

The app uses [installation access tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation) to interact with repositories -- no personal access token needed for the bot.

If you also use the snapshot repository management features in the admin panel, extend app permissions with:

- **Contents (Read & Write)** to push synced docs and marker files
- **Administration (Read & Write)** when you want the app to create repositories automatically

`NUXT_GITHUB_TOKEN` remains optional fallback only and is not required for normal GitHub App-based setup.

## Trigger the Bot

Mention the bot in any issue comment:

```
@your-bot-name How do I configure SSO?
```

The bot will:
1. React with an "eyes" emoji to indicate it's processing
2. Search the knowledge base using the same AI agent as the chat
3. Post a reply in the same issue thread
4. React with a "thumbs up" emoji when done

The bot only responds when explicitly mentioned. It ignores its own comments to prevent loops.

## Custom Trigger Name

By default, the bot responds to mentions matching the GitHub App name. If you want a different mention trigger, set `NUXT_PUBLIC_GITHUB_BOT_TRIGGER`:

```bash
NUXT_PUBLIC_GITHUB_APP_NAME=your-bot-name
NUXT_PUBLIC_GITHUB_BOT_TRIGGER=ask-ai    # Users will @ask-ai instead of @your-bot-name
```

## Auto-Reply to New Issues

You can optionally configure the bot to reply to **all** new issues automatically, without requiring a mention. Set in `nuxt.config.ts`:

```typescript
runtimeConfig: {
  github: {
    replyToNewIssues: true,
  },
}
```

When enabled, the bot will respond to every new issue opened in repositories where the GitHub App is installed.

## How It Works Under the Hood

The bot is built on the [Vercel Chat SDK](https://github.com/vercel-labs/chat) with a custom GitHub adapter. It uses the [Octokit](https://github.com/octokit/rest.js) library with [GitHub App authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/about-authentication-with-a-github-app) to interact with the GitHub API.

Each response goes through the same AI agent pipeline as the chat interface, using [Vercel AI SDK](https://ai-sdk.dev) tools to search the knowledge base in a [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox). For the full architecture, see the [Architecture documentation](https://github.com/vercel-labs/knowledge-agent-template/blob/main/docs/ARCHITECTURE.md) on GitHub. To build your own adapter, see the [Customization Guide](https://github.com/vercel-labs/knowledge-agent-template/blob/main/docs/CUSTOMIZATION.md#4-add-a-bot-adapter).
