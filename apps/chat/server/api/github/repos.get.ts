import { z } from 'zod'
import { requireAdmin } from '../../utils/admin'
import { listAvailableRepositories, listAvailableRepositoriesCached } from '../../utils/github'

const querySchema = z.object({
  owner: z.string().optional(),
  force: z.coerce.boolean().optional(),
})

/**
 * GET /api/github/repos
 * Lists repositories accessible by configured GitHub credentials (admin only).
 */
export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  await requireAdmin(event)
  const config = useRuntimeConfig()
  const query = await getValidatedQuery(event, querySchema.parse)

  const authOptions = {
    explicitToken: config.github.token || undefined,
    appId: config.github.appId || undefined,
    appPrivateKey: config.github.appPrivateKey || undefined,
  }

  const repos = query.force
    ? await listAvailableRepositories(authOptions)
    : await listAvailableRepositoriesCached(authOptions)

  const filtered = query.owner
    ? repos.filter(repo => repo.owner.toLowerCase() === query.owner?.toLowerCase())
    : repos

  requestLog.set({
    ownerFilter: query.owner || null,
    force: query.force === true,
    cacheMode: query.force ? 'bypass' : 'nitro-cached-function',
    totalRepos: repos.length,
    returnedRepos: filtered.length,
  })

  return {
    count: filtered.length,
    repositories: filtered,
    cache: {
      strategy: 'nitro-defineCachedFunction',
      mode: query.force ? 'bypass' : 'cached',
    },
  }
})
