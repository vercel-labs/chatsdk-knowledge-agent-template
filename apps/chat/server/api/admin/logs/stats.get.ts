import { db, schema } from '@nuxthub/db'
import { count, min, max, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const e = schema.evlogEvents

  const dayExpr = sql<string>`left(${e.timestamp}, 10)`

  const [levelRows, dailyRows, meta] = await Promise.all([
    db.select({
      level: e.level,
      count: count(),
    }).from(e).groupBy(e.level),

    db.select({
      day: dayExpr,
      count: count(),
    }).from(e).groupBy(dayExpr).orderBy(dayExpr),

    db.select({
      total: count(),
      oldest: min(e.timestamp),
      newest: max(e.timestamp),
    }).from(e),
  ])

  return {
    totalCount: Number(meta[0]?.total ?? 0),
    oldestLog: meta[0]?.oldest ?? null,
    newestLog: meta[0]?.newest ?? null,
    levelBreakdown: levelRows.map(r => ({ level: r.level, count: Number(r.count) })),
    dailyVolume: dailyRows.map(r => ({ day: r.day, count: Number(r.count) })),
  }
})
