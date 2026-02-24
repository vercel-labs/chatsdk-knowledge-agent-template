# Knowledge Agent Template SDK

The [`@savoir/sdk`](https://github.com/vercel-labs/knowledge-agent-template/tree/main/packages/sdk) package provides a TypeScript client for interacting with Knowledge Agent Template programmatically. It exposes [AI SDK](https://ai-sdk.dev)-compatible tools that let any AI model search and read your knowledge base. For the full API reference and error handling, see the [SDK README](https://github.com/vercel-labs/knowledge-agent-template/blob/main/packages/sdk/README.md) on GitHub.

## Installation

::code-group
```bash [bun]
bun add @savoir/sdk
```
```bash [pnpm]
pnpm add @savoir/sdk
```
```bash [yarn]
yarn add @savoir/sdk
```
```bash [npm]
npm install @savoir/sdk
```
::

## Configuration

```typescript
import { createSavoir } from '@savoir/sdk'

const savoir = createSavoir({
  apiUrl: process.env.SAVOIR_API_URL!,
  apiKey: process.env.SAVOIR_API_KEY!, // Better Auth API key
})
```

You'll need an API key to authenticate. See [API Keys](/admin/docs/api-keys) for how to create one.

### Config Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiUrl` | `string` | Yes | Base URL of your API |
| `apiKey` | `string` | No | API key for authentication. See [API Keys](/admin/docs/api-keys). |
| `sessionId` | `string` | No | Reuse an existing [sandbox](https://vercel.com/docs/vercel-sandbox) session |
| `source` | `string` | No | Usage source identifier (e.g. `'github-bot'`). Defaults to `'sdk'`. |
| `sourceId` | `string` | No | Tracking ID (e.g. `'issue-123'`) |
| `onToolCall` | `function` | No | Callback fired on tool execution (loading/done/error) |

## AI SDK Tools

The SDK exposes tools compatible with the [Vercel AI SDK](https://ai-sdk.dev). Use them with [`generateText`](https://ai-sdk.dev/docs/ai-sdk-core/generating-text) or [`streamText`](https://ai-sdk.dev/docs/ai-sdk-core/streaming-text) to give any AI model access to your knowledge base.

```typescript
import { generateText } from 'ai'
import { createSavoir } from '@savoir/sdk'

const savoir = createSavoir({
  apiUrl: process.env.SAVOIR_API_URL!,
  apiKey: process.env.SAVOIR_API_KEY!,
})

const { text } = await generateText({
  model: yourModel, // any AI SDK compatible model
  tools: savoir.tools,
  maxSteps: 10,
  prompt: 'How do I configure authentication?',
})
```

The `model` can be any [AI SDK provider](https://ai-sdk.dev/providers) -- OpenAI, Anthropic, Google, Mistral, or the [Vercel AI Gateway](https://ai-sdk.dev).

### Available Tools

| Tool | Description |
|------|-------------|
| `bash` | Execute a single bash command in the documentation [sandbox](https://vercel.com/docs/vercel-sandbox) |
| `bash_batch` | Execute multiple commands in a single request (more efficient) |

The AI model uses these tools to run `grep`, `find`, `cat`, `head`, etc. against the aggregated documentation in the sandbox. See [How It Works](/admin/docs/getting-started#how-it-works) for the full flow.

## Client Methods

The `savoir.client` property exposes the low-level `SavoirClient` for direct API access:

```typescript
// Execute bash command
const result = await savoir.client.bash('grep -rl "authentication" docs/')
console.log(result.stdout)

// Execute multiple commands
const batchResult = await savoir.client.bashBatch([
  'find docs/ -name "*.md" | head -10',
  'cat docs/my-framework/getting-started/installation.md',
])

// List all indexed sources
const sources = await savoir.client.getSources()

// Trigger sync (runs as a Vercel Workflow)
await savoir.client.sync({ reset: false, push: true })

// Get agent configuration
const config = await savoir.client.getAgentConfig()
```

## Reporting Usage

After generating a response, report token usage for analytics (visible in the [admin stats panel](/admin/stats)):

```typescript
const startTime = Date.now()

const result = await generateText({
  model: yourModel,
  tools: savoir.tools,
  maxSteps: 10,
  prompt: 'How do I configure middleware?',
})

// reportUsage accepts any AI SDK generate result
await savoir.reportUsage(result, {
  startTime, // auto-computes durationMs
  sourceId: 'my-integration', // optional tracking ID
})
```

The `reportUsage` method automatically extracts `totalUsage` (input/output tokens) and `response.modelId` from the [AI SDK result](https://ai-sdk.dev/docs/ai-sdk-core/generating-text#generatetext).

## Full Example

```typescript
import { generateText } from 'ai'
import { createSavoir } from '@savoir/sdk'

const savoir = createSavoir({
  apiUrl: process.env.SAVOIR_API_URL!,
  apiKey: process.env.SAVOIR_API_KEY!,
  source: 'my-app',
})

async function ask(question: string) {
  const startTime = Date.now()

  const result = await generateText({
    model: yourModel,
    tools: savoir.tools,
    maxSteps: 10,
    prompt: question,
  })

  await savoir.reportUsage(result, { startTime })

  return result.text
}
```

## Error Handling

```typescript
import { SavoirError, NetworkError } from '@savoir/sdk'

try {
  await savoir.client.bash('some-command')
} catch (error) {
  if (error instanceof SavoirError) {
    console.log(error.statusCode) // HTTP status code
    console.log(error.message)

    if (error.isAuthError()) { /* 401 */ }
    if (error.isRateLimitError()) { /* 429 */ }
    if (error.isServerError()) { /* 5xx */ }
  }
  if (error instanceof NetworkError) {
    console.log(error.message)
    console.log(error.cause) // Original error
  }
}
```
