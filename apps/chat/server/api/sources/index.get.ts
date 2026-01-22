import { db, schema } from '@nuxthub/db'
import { asc } from 'drizzle-orm'

/**
 * GET /api/sources
 * List all sources grouped by type
 */
export default defineEventHandler(async () => {
  const allSources = await db.query.sources.findMany({
    orderBy: () => asc(schema.sources.label),
  })

  return {
    github: allSources.filter(s => s.type === 'github'),
    youtube: allSources.filter(s => s.type === 'youtube'),
  }
})
