# Coding Guidelines

## Comments

Only add comments when the code is truly complex or non-obvious.

### When to Comment

```typescript
// ✅ Explains non-obvious choice
// Use grep instead of ripgrep (more widely available in sandboxes)
const result = await sandbox.runCommand({ cmd: 'grep', ... })

// ✅ Short JSDoc for public functions
/** Returns session if exists and not expired, null otherwise */
export async function getSession(sessionId: string): Promise<SandboxSession | null>
```

### When NOT to Comment

```typescript
// ❌ Repeating function name
/** Get session */
export function getSession()

// ❌ Section dividers in templates
<!-- Header -->
<div>...</div>
<!-- Actions -->
<div>...</div>
```

### Exception: Schema Section Dividers

Section dividers ARE useful in data structures to group related fields:

```typescript
export const sources = sqliteTable('sources', {
  // Common fields
  label: text('label'),

  // GitHub fields
  repo: text('repo'),
  branch: text('branch'),

  // YouTube fields
  channelId: text('channel_id'),
})
```

## Caching

Never use in-memory caches in serverless environments:

```typescript
// ❌ Doesn't work in serverless
const cache = new Map<string, Data>()

// ✅ Use NuxtHub KV
const kv = hubKV()
const cached = await kv.get<Data>('my-key')
await kv.set('my-key', data)
```

## Nuxt Auto-imports

These directories are auto-imported - no `import` statements needed:

| Directory | Available in |
|-----------|--------------|
| `app/composables/` | Client |
| `app/components/` | Client |
| `server/utils/` | Server |
| `shared/utils/` | Both |
| `shared/types/` | Both (via `#shared/types`) |
