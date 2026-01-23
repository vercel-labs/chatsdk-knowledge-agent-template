# Logging

Use `@savoir/logger` for all logging.

## Simple Logs

For workflow progress and general logging:

```typescript
import { getLogger } from '@savoir/logger'

const logger = getLogger()

logger.log('sandbox', `Created: ${sandboxId}`)
logger.log('sync', `${sourceId}: synced ${fileCount} files`)
```

## Wide Events

For request logging (one event per request):

```typescript
import { getLogger } from '@savoir/logger'

const logger = getLogger()

export default defineEventHandler(async (event) => {
  const log = logger.request({
    method: event.method,
    path: event.path,
  })

  try {
    const user = await getUser(event)
    log.set({ userId: user.id, plan: user.plan })

    const result = await doWork()
    log.set({ itemCount: result.items.length })

    return result
  } catch (error) {
    log.error(error)
    throw error
  } finally {
    log.emit()
  }
})
```

## Structured Errors

```typescript
import { createError } from '@savoir/logger'

throw createError({
  message: 'Failed to sync repository',
  why: 'GitHub API rate limit exceeded',
  fix: 'Wait 1 hour or use a different token',
  link: 'https://docs.github.com/en/rest/rate-limit',
  cause: originalError,
})
```

## What to Log

**Good logs include:**
- Unique identifiers (`sandboxId`, `sessionId`, `userId`)
- Quantifiable metrics (`count`, `fileCount`)
- Final summaries with statistics

**Avoid:**
- Obvious steps: `logger.log('sync', 'Taking snapshot...')`
- Messages without data: `logger.log('sync', 'No changes')`
