# Admin Mode

Admin mode lets you **talk directly to your application**. Instead of searching documentation, the AI agent queries your database, browses your logs, analyzes errors, and generates charts -- all through natural language.

## How to Access

Admin mode is automatically granted to the first user who signs up. Additional admins can be promoted from the admin users page. When you're an admin, a mode toggle appears on the homepage letting you switch between **Chat** (documentation search) and **Admin** (application monitoring).

Admin chats are marked with a shield icon in the sidebar.

## Built-in Tools

In admin mode, the AI agent has access to a set of tools designed for application monitoring and analytics:

### Usage & Analytics

| Tool | Description |
|------|-------------|
| `query_stats` | Query usage statistics: messages sent, tokens used, active models, user feedback -- filterable by date range |
| `list_users` | List users with their activity and token usage, sortable by messages, tokens, or last activity |
| `query_chats` | Browse recent chats to inspect what questions are being asked and how they're handled |

### Logs & Errors

| Tool | Description |
|------|-------------|
| `query_logs` | Browse application logs by level, HTTP path, status code, method -- with full-text search |
| `log_stats` | Aggregated metrics: total requests, error rates, status code distribution, latency percentiles (p50/p95/p99), top slow/busy/error endpoints |
| `query_errors` | Error analysis: recent errors, grouped by path or message, hourly error trends |

### Configuration & Data

| Tool | Description |
|------|-------------|
| `list_sources` | List all configured knowledge base sources |
| `get_agent_config` | View current agent configuration (model, temperature, response style, etc.) |
| `run_sql` | Execute read-only SQL queries (SELECT only) against all application tables |

### Visualization

| Tool | Description |
|------|-------------|
| `chart` | Generate line charts from time-series data, with automatic gap-filling for missing dates |

## Example Prompts

Here are some things you can ask in admin mode:

- "How many messages were sent this week?"
- "Show me the most active users"
- "Are there any errors in the last 24 hours?"
- "What's the p95 latency for the chat endpoint?"
- "Chart the daily message count over the last 30 days"
- "Which models are being used the most?"
- "Show me the top 5 slowest endpoints"
- "What questions are users asking about the most?"

## Structured Logging with evlog

Knowledge Agent Template uses [`@evlog/nuxthub`](https://github.com/HugoRCD/evlog) for structured logging. Every API request, bot interaction, and workflow execution is automatically logged to the `evlog_events` table in your [NuxtHub](https://hub.nuxt.com) database.

This means:

- **Logs are queryable** -- the admin tools can search, filter, and aggregate log data
- **Retention is automatic** -- logs older than 7 days are cleaned up by a daily cron job
- **No external service needed** -- everything is stored in your NuxtHub SQLite database

Each log event includes the HTTP method, path, status code, duration, request ID, and optional structured data. The `query_logs`, `log_stats`, and `query_errors` tools leverage this data to give you real-time insights into your application.

## How It Works

Admin mode uses a completely separate AI pipeline from the regular chat:

1. When you create an admin chat, the server loads the **admin tools** instead of the documentation sandbox tools
2. The AI agent receives a specialized system prompt that instructs it to use the admin tools for monitoring and analytics
3. All queries run directly against your [NuxtHub](https://hub.nuxt.com) database -- no sandbox is involved
4. The `chart` tool can render visual time-series charts inline in the conversation

Admin chats are stored like regular chats but tagged with `mode: 'admin'` in the database.

For a deeper look at the architecture behind admin mode and other components, see the [Architecture documentation](https://github.com/vercel-labs/knowledge-agent-template/blob/main/docs/ARCHITECTURE.md) on GitHub.
