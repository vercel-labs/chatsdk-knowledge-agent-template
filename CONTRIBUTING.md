# Contributing to Knowledge Agent Template

Thank you for your interest in contributing to Knowledge Agent Template!

## Reporting Bugs

- Search [existing issues](https://github.com/vercel-labs/knowledge-agent-template/issues) before opening a new one
- Include steps to reproduce, expected behavior, and actual behavior
- Include your environment (Node version, OS, browser)

## Suggesting Features

- Open a [feature request issue](https://github.com/vercel-labs/knowledge-agent-template/issues/new)
- Describe the use case and why it would be valuable
- If possible, outline a proposed implementation

## Development Setup

```bash
# Clone the repo
git clone https://github.com/vercel-labs/knowledge-agent-template.git
cd knowledge-agent-template

# Install dependencies
bun install

# Set up environment variables
cp apps/app/.env.example apps/app/.env
# Edit .env with your configuration

# Start dev server
bun run dev
```

## Project Structure

```
knowledge-agent-template/
├── apps/app/          # Nuxt application (chat UI + API + bots)
├── packages/sdk/       # @savoir/sdk - AI SDK compatible tools
├── packages/agent/     # @savoir/agent - Agent core (router, prompts, tools)
└── docs/               # Documentation
```

## Making Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run checks:
   ```bash
   bun run lint:fix
   bun run typecheck
   bun run build
   ```
5. Commit with a descriptive message
6. Open a pull request

## Code Style

- Follow the existing ESLint configuration (`@hrcd/eslint-config`)
- See [docs/CODING-GUIDELINES.md](./docs/CODING-GUIDELINES.md) for detailed guidelines
- Write TypeScript with proper types
- Keep changes focused and minimal

## Pull Request Process

1. Ensure all checks pass (lint, typecheck, build)
2. Update documentation if your change affects user-facing behavior
3. Add a clear description of what changed and why
4. Request review from maintainers

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
