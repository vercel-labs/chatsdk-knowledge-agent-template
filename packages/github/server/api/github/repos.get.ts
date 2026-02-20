import { createHash } from 'node:crypto'
import { z } from 'zod'
import { listUserRepos, listAppRepos, type RepoInfo } from '../../utils'
import { resolveGitHubAuth, type GitHubAuth } from '../../utils/auth'

const listReposCached = defineCachedFunction(
  async (_fingerprint: string, auth: GitHubAuth): Promise<RepoInfo[]> => {
    return auth.type === 'pat'
      ? await listUserRepos(auth.token)
      : await listAppRepos(auth)
  },
  {
    name: 'github-repos',
    maxAge: 60,
    swr: true,
    getKey: (fingerprint: string) => fingerprint,
  },
)

function buildFingerprint(auth: GitHubAuth): string {
  const hasher = createHash('sha256')
  hasher.update(auth.type === 'pat' ? `pat|${auth.token}` : `app|${auth.appId}`)
  return hasher.digest('hex')
}

const querySchema = z.object({
  owner: z.string().optional(),
  force: z.coerce.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const requestLog = useLogger(event)
  await requireAdmin(event)
  const config = useRuntimeConfig()
  const query = await getValidatedQuery(event, querySchema.parse)

  const auth = resolveGitHubAuth(config.github)
  if (!auth) {
    throw createError({
      statusCode: 400,
      message: 'GitHub credentials not configured',
      data: {
        why: 'Missing NUXT_GITHUB_TOKEN or NUXT_GITHUB_APP_ID/NUXT_GITHUB_APP_PRIVATE_KEY',
        fix: 'Set one of these in your environment or nuxt.config',
      },
    })
  }

  const repos = query.force
    ? await (auth.type === 'pat' ? listUserRepos(auth.token) : listAppRepos(auth))
    : await listReposCached(buildFingerprint(auth), auth)

  const filtered = query.owner
    ? repos.filter(repo => repo.owner.toLowerCase() === query.owner?.toLowerCase())
    : repos

  requestLog.set({
    ownerFilter: query.owner || null,
    force: query.force === true,
    cacheMode: query.force ? 'bypass' : 'swr',
    totalRepos: repos.length,
    returnedRepos: filtered.length,
  })

  return {
    count: filtered.length,
    repositories: filtered,
  }
})
