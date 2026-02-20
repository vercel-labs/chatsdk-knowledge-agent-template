import { createError } from 'evlog'
import { createAppOctokit, getAppInstallationToken } from '../auth'
import { createOctokit, paginateAll } from './utils'

export function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'status' in error
    && (error as { status: unknown }).status === 404
  )
}

export interface RepoInfo {
  id: number
  name: string
  fullName: string
  owner: string
  private: boolean
  defaultBranch?: string
  htmlUrl: string
}

export function parseRepoPath(repoPath: string): { owner: string; repo: string } {
  const [owner, repo, ...rest] = repoPath.split('/')
  if (!owner || !repo || rest.length > 0) {
    throw createError({
      status: 400,
      message: 'Invalid repository format',
      why: `Expected "owner/repo", received "${repoPath}"`,
      fix: 'Use the "owner/repo" format',
    })
  }
  return { owner, repo }
}

export function mapRepository(repo: any): RepoInfo {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner?.login || repo.full_name.split('/')[0] || '',
    private: repo.private,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
  }
}

export async function getRepo(owner: string, repo: string, token: string): Promise<RepoInfo> {
  const octokit = createOctokit(token)
  const existing = await octokit.repos.get({ owner, repo })
  return mapRepository(existing.data)
}

export async function createRepo(
  options: {
    name: string
    owner?: string
    private?: boolean
    autoInit?: boolean
  },
  token: string,
): Promise<RepoInfo> {
  const octokit = createOctokit(token)

  if (options.owner) {
    const me = await octokit.users.getAuthenticated()
    if (me.data.login.toLowerCase() === options.owner.toLowerCase()) {
      const created = await octokit.repos.createForAuthenticatedUser({
        name: options.name,
        private: options.private ?? true,
        auto_init: options.autoInit ?? true,
      })
      return mapRepository(created.data)
    }
    const created = await octokit.repos.createInOrg({
      org: options.owner,
      name: options.name,
      private: options.private ?? true,
      auto_init: options.autoInit ?? true,
    })
    return mapRepository(created.data)
  }
  const created = await octokit.repos.createForAuthenticatedUser({
    name: options.name,
    private: options.private ?? true,
    auto_init: options.autoInit ?? true,
  })
  return mapRepository(created.data)
}

function uniqueRepositories(repos: RepoInfo[]): RepoInfo[] {
  const byFullName = new Map<string, RepoInfo>()
  for (const repo of repos) {
    byFullName.set(repo.fullName, repo)
  }
  return [...byFullName.values()].sort((a, b) => a.fullName.localeCompare(b.fullName))
}

export async function listUserRepos(token: string): Promise<RepoInfo[]> {
  const octokit = createOctokit(token)
  const repos = await paginateAll(async (page) => {
    const result = await octokit.repos.listForAuthenticatedUser({
      affiliation: 'owner,collaborator,organization_member',
      per_page: 100,
      page,
      visibility: 'all',
    })
    return result.data
  })
  return uniqueRepositories(repos.map(mapRepository))
}

export async function listAppRepos(options: { appId: string; appPrivateKey: string }): Promise<RepoInfo[]> {
  const appOctokit = createAppOctokit(options.appId, options.appPrivateKey)
  if (!appOctokit) {
    return []
  }

  const installations = await paginateAll(async (page) => {
    const result = await appOctokit.apps.listInstallations({ per_page: 100, page })
    return result.data
  })

  const allRepos: RepoInfo[] = []

  for (const installation of installations) {
    const token = await getAppInstallationToken(options.appId, options.appPrivateKey, installation.id)
    const installationOctokit = createOctokit(token)
    const repos = await paginateAll(async (page) => {
      const result = await installationOctokit.apps.listReposAccessibleToInstallation({ per_page: 100, page })
      return result.data.repositories
    })
    allRepos.push(...repos.map(mapRepository))
  }

  return uniqueRepositories(allRepos)
}
