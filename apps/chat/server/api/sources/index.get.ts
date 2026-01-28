import { kv } from '@nuxthub/kv'
import { db, schema } from '@nuxthub/db'
import { asc } from 'drizzle-orm'
import { KV_KEYS } from '../../utils/sandbox/types'

/**
 * GET /api/sources
 * List all sources grouped by type
 *
 * Response format matches SourcesResponse from @savoir/sdk
 */
export default defineEventHandler(async () => {
  const [allSources, lastSyncAt] = await Promise.all([
    db.select().from(schema.sources).orderBy(asc(schema.sources.label)),
    kv.get<number>(KV_KEYS.LAST_SOURCE_SYNC),
  ])

  const github = allSources.filter(s => s.type === 'github')
  const youtube = allSources.filter(s => s.type === 'youtube')

  return {
    total: allSources.length,
    lastSyncAt,
    github: {
      count: github.length,
      sources: github,
    },
    youtube: {
      count: youtube.length,
      sources: youtube,
    },
  }
})
