# Knowledge Agent Template

AI agents with real-time knowledge base access.

## Quick Reference

| Command | Description |
|---------|-------------|
| `bun install` | Install dependencies |
| `bun run dev` | Start dev server |
| `bun run build` | Build all packages |
| `bun run test` | Run tests |
| `bun run lint` | Lint all packages |
| `bun run typecheck` | Type check |

## Structure

```
knowledge-agent-template/
├── apps/app/          # Nuxt app (chat UI + API + bots)
│   ├── app/            # Vue components, pages
│   └── server/         # API, workflows, sandbox, bot adapters
└── packages/
    └── sdk/            # @savoir/sdk - AI SDK tools (bash, bash_batch)
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design, API specs, components
- [Sources](docs/SOURCES.md) - Content sources configuration
- [Coding Guidelines](docs/CODING-GUIDELINES.md) - Code style, patterns
- [Environment](docs/ENVIRONMENT.md) - Environment variables
- [Customization](docs/CUSTOMIZATION.md) - How to customize the instance

## Local Skills (`.agents/skills/`)

Project-specific guides for AI-assisted customization. When the user asks to add a tool, source, bot adapter, or rename the project, follow the corresponding skill:

| Skill | File | Use when |
|-------|------|----------|
| Add Tool | `add-tool.md` | Adding a new AI SDK tool |
| Add Source | `add-source.md` | Adding a GitHub or file knowledge source |
| Add Bot Adapter | `add-bot-adapter.md` | Adding a new platform (Slack, Linear, etc.) |
| Rename Project | `rename-project.md` | Renaming the project from "Knowledge Agent Template" |
