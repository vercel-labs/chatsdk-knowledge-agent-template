# @savoir/sdk

SDK for [Knowledge Agent Template](https://github.com/vercel-labs/knowledge-agent-template) — AI agents with up-to-date knowledge base access.

Provides [AI SDK](https://ai-sdk.dev) compatible tools to query content in a sandboxed environment.

> See also: [Main README](../../README.md), [Architecture](../../docs/ARCHITECTURE.md), [Environment Variables](../../docs/ENVIRONMENT.md)

## Installation

```bash
npm install @savoir/sdk
# or
bun add @savoir/sdk
# or
pnpm add @savoir/sdk
```

## Configuration

Set the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `SAVOIR_API_URL` | Yes | Base URL of your API |
| `SAVOIR_API_KEY` | No | API key for authentication ([Better Auth](https://www.better-auth.com) API key). |

## Quick Start

```ts
import { createSavoir } from '@savoir/sdk'
import { generateText } from 'ai'

const savoir = createSavoir({
  apiUrl: process.env.SAVOIR_API_URL!,
  apiKey: process.env.SAVOIR_API_KEY, // Optional if API doesn't require auth
})

const { text } = await generateText({
  model: 'google/gemini-3-flash',
  tools: savoir.tools,
  maxSteps: 10,
  prompt: 'How do I configure authentication?',
})

console.log(text)
```

## API Reference

### `createSavoir(config)`

Creates an instance with API client and AI SDK tools.

```ts
import { createSavoir } from '@savoir/sdk'

const savoir = createSavoir({
  apiUrl: process.env.SAVOIR_API_URL!,
  apiKey: process.env.SAVOIR_API_KEY,
  sessionId: 'optional-session-id', // For sandbox reuse
  onToolCall: (info) => {
    // Optional callback for tool execution states
    console.log(`Tool ${info.toolName}: ${info.state}`)
  },
})
```

#### Config Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiUrl` | `string` | Yes | Base URL of your API |
| `apiKey` | `string` | No | API key for authentication |
| `sessionId` | `string` | No | Reuse an existing sandbox session |
| `source` | `string` | No | Usage source identifier (e.g. `'github-bot'`). Defaults to `'sdk'`. |
| `sourceId` | `string` | No | Tracking ID (e.g. `'issue-123'`). Can be overridden per `reportUsage()` call. |
| `onToolCall` | `function` | No | Callback fired on tool execution (loading/done/error) |

#### Returns

```ts
interface Savoir {
  client: SavoirClient           // Low-level HTTP client
  tools: {
    bash: Tool                   // Execute single bash command
    bash_batch: Tool             // Execute multiple commands (more efficient)
  }
  getSessionId(): string | undefined
  setSessionId(sessionId: string): void
  getAgentConfig(): Promise<AgentConfig>
  reportUsage(result: GenerateResult, options?: ReportUsageOptions): Promise<void>
}
```

### Tools

#### `bash`

Execute a single bash command in the documentation [sandbox](https://vercel.com/docs/vercel-sandbox).

```ts
const { text } = await generateText({
  model,
  tools: { bash: savoir.tools.bash },
  prompt: 'List all markdown files in the docs folder',
})
```

#### `bash_batch`

Execute multiple bash commands in a single request. More efficient than multiple single calls as the [sandbox](https://vercel.com/docs/vercel-sandbox) is reused between commands.

```ts
const { text } = await generateText({
  model,
  tools: { bash_batch: savoir.tools.bash_batch },
  prompt: 'Find all TypeScript files and show their first 10 lines',
})
```

### `SavoirClient`

Low-level HTTP client for direct API access. Use `createSavoir()` for the high-level interface.

```ts
import { SavoirClient } from '@savoir/sdk'

const client = new SavoirClient({
  apiUrl: process.env.SAVOIR_API_URL!,
  apiKey: process.env.SAVOIR_API_KEY,
})

// Execute bash command
const result = await client.bash('ls -la')
console.log(result.stdout)

// Execute multiple commands
const batchResult = await client.bashBatch(['pwd', 'ls', 'cat README.md'])

// Get sources configuration
const sources = await client.getSources()

// Trigger sync
await client.sync({ reset: false, push: true })

// Get agent configuration
const config = await client.getAgentConfig()

// Report usage from an AI SDK generate result
await client.reportUsage(result, { startTime: Date.now() })
```

## Error Handling

The SDK exports two error classes:

### `SavoirError`

Thrown when the API returns an error response.

```ts
import { SavoirError } from '@savoir/sdk'

try {
  await client.bash('some-command')
} catch (error) {
  if (error instanceof SavoirError) {
    console.log(error.statusCode) // HTTP status code
    console.log(error.message)    // Error message

    if (error.isAuthError()) {
      // Handle 401
    } else if (error.isRateLimitError()) {
      // Handle 429
    } else if (error.isServerError()) {
      // Handle 5xx
    }
  }
}
```

### `NetworkError`

Thrown when the request fails to reach the API (network issues, DNS errors, etc.).

```ts
import { NetworkError } from '@savoir/sdk'

try {
  await client.bash('some-command')
} catch (error) {
  if (error instanceof NetworkError) {
    console.log(error.message)
    console.log(error.cause) // Original error
  }
}
```

## Types

All types are exported for TypeScript users:

```ts
import type {
  SavoirConfig,
  ShellResponse,
  ShellBatchResponse,
  SyncOptions,
  SyncResponse,
  SourcesResponse,
  AgentConfig,
  GenerateResult,
  ReportUsageOptions,
  ToolCallInfo,
  ToolCallCallback,
  ToolCallState,
} from '@savoir/sdk'
```

## License

MIT
