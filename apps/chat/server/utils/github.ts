import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'
import { createError } from 'evlog'
import { createHash } from 'node:crypto'

type TokenCacheEntry = {
  token: string
  expiresAt: number
}

const tokenCache = new Map<string, TokenCacheEntry>()
const DEFAULT_TOKEN_TTL_MS = 50 * 60 * 1000

export interface GitHubAppCredentials {
  appId?: string
  appPrivateKey?: string
}

export interface SnapshotGitHubAuthOptions extends GitHubAppCredentials {
  explicitToken?: string
}

export interface GitHubRepositoryInfo {
  id: number
  name: string
  fullName: string
  owner: string
  private: boolean
  defaultBranch?: string
  htmlUrl: string
}

export interface EnsureRepositoryResult {
  repository: GitHubRepositoryInfo
  created: boolean
  adoptedExisting: boolean
}

const SAVOIR_MARKER_PATH = '.savoir/snapshot-repo.json'
const SAVOIR_MARKER_VERSION = 1

function decodeGitHubPrivateKey(rawKey: string): string {
  const normalized = rawKey.replace(/\\n/g, '\n').trim()
  if (normalized.includes('BEGIN')) {
    return normalized
  }

  try {
    const decoded = Buffer.from(normalized, 'base64').toString('utf8').trim()
    if (decoded.includes('BEGIN')) {
      return decoded
    }
  } catch {
    // Fall through to return raw key if it's not valid base64.
  }

  return normalized
}

export function parseGitHubRepoPath(snapshotRepo: string): { owner: string, repo: string } {
  const [owner, repo, ...rest] = snapshotRepo.split('/')
  if (!owner || !repo || rest.length > 0) {
    throw createError({
      message: 'Invalid snapshot repository format',
      why: `Expected "owner/repo", received "${snapshotRepo}"`,
      fix: 'Set NUXT_GITHUB_SNAPSHOT_REPO using the "owner/repo" format',
    })
  }
  return { owner, repo }
}

function createAuthedOctokitWithToken(token: string): Octokit {
  return new Octokit({ auth: token })
}

function getCachedToken(cacheKey: string): string | null {
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token
  }
  return null
}

function setCachedToken(cacheKey: string, token: string, ttlMs: number = DEFAULT_TOKEN_TTL_MS): void {
  tokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + ttlMs,
  })
}

function createAppOctokit(credentials: GitHubAppCredentials): Octokit | null {
  if (!credentials.appId || !credentials.appPrivateKey) {
    return null
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: credentials.appId,
      privateKey: decodeGitHubPrivateKey(credentials.appPrivateKey),
    },
  })
}

async function createInstallationTokenForId(credentials: GitHubAppCredentials, installationId: number): Promise<string> {
  if (!credentials.appId || !credentials.appPrivateKey) {
    throw createError({
      status: 500,
      message: 'GitHub App credentials are not configured',
      why: 'Missing app ID or private key',
      fix: 'Set NUXT_GITHUB_APP_ID and NUXT_GITHUB_APP_PRIVATE_KEY',
    })
  }

  const auth = createAppAuth({
    appId: credentials.appId,
    privateKey: decodeGitHubPrivateKey(credentials.appPrivateKey),
  })

  const { token } = await auth({
    type: 'installation',
    installationId,
  })
  return token
}

async function getAppInstallationToken(credentials: GitHubAppCredentials, installationId: number): Promise<string> {
  const cacheKey = `app-installation:${credentials.appId}:${installationId}`
  const cached = getCachedToken(cacheKey)
  if (cached) {
    return cached
  }

  const token = await createInstallationTokenForId(credentials, installationId)
  setCachedToken(cacheKey, token)
  return token
}

async function getAppInstallationForRepo(
  credentials: GitHubAppCredentials,
  snapshotRepo: string,
): Promise<number | null> {
  const appOctokit = createAppOctokit(credentials)
  if (!appOctokit) {
    return null
  }

  const { owner, repo } = parseGitHubRepoPath(snapshotRepo)
  const installation = await appOctokit.apps.getRepoInstallation({ owner, repo })
  return installation.data.id
}

async function getAppInstallationForOwner(
  credentials: GitHubAppCredentials,
  owner: string,
): Promise<number | null> {
  const appOctokit = createAppOctokit(credentials)
  if (!appOctokit) {
    return null
  }

  try {
    const orgInstallation = await appOctokit.apps.getOrgInstallation({ org: owner })
    return orgInstallation.data.id
  } catch {
    // Ignore and try user installation below.
  }

  try {
    const userInstallation = await appOctokit.apps.getUserInstallation({ username: owner })
    return userInstallation.data.id
  } catch {
    return null
  }
}

/**
 * Resolves GitHub credentials for snapshot operations.
 * Priority: explicit token -> GitHub App installation token -> undefined.
 */
export async function resolveSnapshotGitHubToken(options: SnapshotGitHubAuthOptions & {
  snapshotRepo: string
}): Promise<string | undefined> {
  if (options.explicitToken) {
    return options.explicitToken
  }

  if (!options.snapshotRepo?.trim()) {
    return undefined
  }

  return await getGitHubAppInstallationTokenForRepo({
    repoPath: options.snapshotRepo,
    appId: options.appId,
    appPrivateKey: options.appPrivateKey,
  })
}

/**
 * Returns an installation access token for a specific repository.
 * Returns undefined when app credentials are not configured.
 */
export async function getGitHubAppInstallationTokenForRepo(options: GitHubAppCredentials & {
  repoPath: string
}): Promise<string | undefined> {
  if (!options.appId || !options.appPrivateKey) {
    return undefined
  }

  let installationId: number | null = null
  try {
    installationId = await getAppInstallationForRepo(options, options.repoPath)
  } catch {
    installationId = null
  }

  if (!installationId) {
    return undefined
  }

  return await getAppInstallationToken(options, installationId)
}

function mapRepository(repo: {
  id: number
  name: string
  full_name: string
  private: boolean
  html_url: string
  default_branch?: string
  owner?: { login?: string | null } | null
}): GitHubRepositoryInfo {
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

function uniqueRepositories(repos: GitHubRepositoryInfo[]): GitHubRepositoryInfo[] {
  const byFullName = new Map<string, GitHubRepositoryInfo>()
  for (const repo of repos) {
    byFullName.set(repo.fullName, repo)
  }
  return [...byFullName.values()].sort((a, b) => a.fullName.localeCompare(b.fullName))
}

async function paginateAll<T>(
  fetchPage: (page: number) => Promise<T[]>,
  perPage: number = 100,
): Promise<T[]> {
  const items: T[] = []
  let page = 1

  while (true) {
    const currentPage = await fetchPage(page)
    items.push(...currentPage)

    if (currentPage.length < perPage) {
      break
    }
    page += 1
  }

  return items
}

async function listRepositoriesWithApp(options: GitHubAppCredentials): Promise<GitHubRepositoryInfo[]> {
  const appOctokit = createAppOctokit(options)
  if (!appOctokit) {
    return []
  }

  const installations = await paginateAll(async (page) => {
    const result = await appOctokit.apps.listInstallations({ per_page: 100, page })
    return result.data
  })

  const allRepos: GitHubRepositoryInfo[] = []

  for (const installation of installations) {
    const token = await getAppInstallationToken(options, installation.id)
    const installationOctokit = createAuthedOctokitWithToken(token)
    const repos = await paginateAll(async (page) => {
      const result = await installationOctokit.apps.listReposAccessibleToInstallation({ per_page: 100, page })
      return result.data.repositories
    })
    allRepos.push(...repos.map(mapRepository))
  }

  return uniqueRepositories(allRepos)
}

async function listRepositoriesWithToken(token: string): Promise<GitHubRepositoryInfo[]> {
  const octokit = createAuthedOctokitWithToken(token)
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

export async function listAvailableRepositories(options: SnapshotGitHubAuthOptions): Promise<GitHubRepositoryInfo[]> {
  if (options.explicitToken) {
    return await listRepositoriesWithToken(options.explicitToken)
  }

  return await listRepositoriesWithApp(options)
}

function buildCacheFingerprint(options: SnapshotGitHubAuthOptions): string {
  const hasher = createHash('sha256')
  hasher.update(String(options.appId ?? 'app:none'))
  hasher.update('|')
  hasher.update(String(options.explicitToken ?? 'token:none'))
  return hasher.digest('hex')
}

const listAvailableRepositoriesCachedInternal = defineCachedFunction(
  async (cacheFingerprint: string): Promise<GitHubRepositoryInfo[]> => {
    void cacheFingerprint
    const config = useRuntimeConfig()
    return await listAvailableRepositories({
      explicitToken: config.github.token || undefined,
      appId: config.github.appId || undefined,
      appPrivateKey: config.github.appPrivateKey || undefined,
    })
  },
  {
    name: 'github-repositories-catalog',
    maxAge: 60,
    swr: true,
    getKey: (cacheFingerprint: string) => cacheFingerprint,
  },
)

export async function listAvailableRepositoriesCached(options: SnapshotGitHubAuthOptions): Promise<GitHubRepositoryInfo[]> {
  const cacheFingerprint = buildCacheFingerprint(options)
  return await listAvailableRepositoriesCachedInternal(cacheFingerprint)
}

interface EnsureRepositoryOptions extends SnapshotGitHubAuthOptions {
  repoPath: string
  branch?: string
  allowExisting?: boolean
}

async function ensureBranchExists(
  octokit: Octokit,
  repoPath: string,
  branch: string,
): Promise<void> {
  const { owner, repo } = parseGitHubRepoPath(repoPath)
  const branchName = branch.trim() || 'main'

  try {
    await octokit.repos.getBranch({ owner, repo, branch: branchName })
    return
  } catch {
    // Create branch from default branch when missing.
  }

  const repoInfo = await octokit.repos.get({ owner, repo })
  const defaultBranch = repoInfo.data.default_branch
  const defaultRef = await octokit.git.getRef({ owner, repo, ref: `heads/${defaultBranch}` })

  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: defaultRef.data.object.sha,
  })
}

async function hasSavoirMarker(
  octokit: Octokit,
  repoPath: string,
  branch: string,
): Promise<boolean> {
  const { owner, repo } = parseGitHubRepoPath(repoPath)
  try {
    await octokit.repos.getContent({
      owner,
      repo,
      path: SAVOIR_MARKER_PATH,
      ref: branch,
    })
    return true
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 404) {
      return false
    }
    throw error
  }
}

async function ensureSavoirMarker(
  octokit: Octokit,
  repoPath: string,
  branch: string,
): Promise<void> {
  const { owner, repo } = parseGitHubRepoPath(repoPath)
  const markerContent = {
    managedBy: 'savoir',
    version: SAVOIR_MARKER_VERSION,
    createdAt: new Date().toISOString(),
  }

  let sha: string | undefined
  try {
    const existing = await octokit.repos.getContent({
      owner,
      repo,
      path: SAVOIR_MARKER_PATH,
      ref: branch,
    })
    if (!Array.isArray(existing.data) && existing.data.type === 'file') {
      sha = existing.data.sha
    }
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status !== 404) {
      throw error
    }
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: SAVOIR_MARKER_PATH,
    branch,
    message: sha
      ? 'chore: refresh savoir snapshot marker'
      : 'chore: initialize savoir snapshot marker',
    content: Buffer.from(JSON.stringify(markerContent, null, 2)).toString('base64'),
    sha,
  })
}

async function ensureRepoWithAuthenticatedToken(
  token: string,
  repoPath: string,
  branch: string,
  allowExisting: boolean,
): Promise<EnsureRepositoryResult> {
  const octokit = createAuthedOctokitWithToken(token)
  const { owner, repo } = parseGitHubRepoPath(repoPath)

  try {
    const existing = await octokit.repos.get({ owner, repo })
    await ensureBranchExists(octokit, repoPath, branch)
    const hasMarker = await hasSavoirMarker(octokit, repoPath, branch)

    if (!hasMarker && !allowExisting) {
      throw createError({
        status: 409,
        message: 'Repository already exists and is not managed by Savoir',
        why: `The repository ${repoPath} exists but has no ${SAVOIR_MARKER_PATH} marker`,
        fix: 'Confirm adoption explicitly, or choose a new repository name',
      })
    }

    if (!hasMarker) {
      await ensureSavoirMarker(octokit, repoPath, branch)
    }

    return {
      repository: mapRepository(existing.data),
      created: false,
      adoptedExisting: !hasMarker,
    }
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status !== 404) {
      throw error
    }
  }

  const me = await octokit.users.getAuthenticated()
  const created = me.data.login.toLowerCase() === owner.toLowerCase()
    ? await octokit.repos.createForAuthenticatedUser({
      name: repo,
      private: true,
      auto_init: true,
    })
    : await octokit.repos.createInOrg({
      org: owner,
      name: repo,
      private: true,
      auto_init: true,
    })

  await ensureBranchExists(octokit, repoPath, branch)
  await ensureSavoirMarker(octokit, repoPath, branch)
  return {
    repository: mapRepository(created.data),
    created: true,
    adoptedExisting: false,
  }
}

async function ensureRepoWithApp(
  appCredentials: GitHubAppCredentials,
  repoPath: string,
  branch: string,
  allowExisting: boolean,
): Promise<EnsureRepositoryResult> {
  const { owner, repo } = parseGitHubRepoPath(repoPath)

  let repoToken = await getGitHubAppInstallationTokenForRepo({
    repoPath,
    appId: appCredentials.appId,
    appPrivateKey: appCredentials.appPrivateKey,
  })

  if (repoToken) {
    const existingOctokit = createAuthedOctokitWithToken(repoToken)
    const existingRepo = await existingOctokit.repos.get({ owner, repo })
    await ensureBranchExists(existingOctokit, repoPath, branch)
    const hasMarker = await hasSavoirMarker(existingOctokit, repoPath, branch)

    if (!hasMarker && !allowExisting) {
      throw createError({
        status: 409,
        message: 'Repository already exists and is not managed by Savoir',
        why: `The repository ${repoPath} exists but has no ${SAVOIR_MARKER_PATH} marker`,
        fix: 'Confirm adoption explicitly, or choose a new repository name',
      })
    }

    if (!hasMarker) {
      await ensureSavoirMarker(existingOctokit, repoPath, branch)
    }

    return {
      repository: mapRepository(existingRepo.data),
      created: false,
      adoptedExisting: !hasMarker,
    }
  }

  const ownerInstallationId = await getAppInstallationForOwner(appCredentials, owner)
  if (!ownerInstallationId) {
    throw createError({
      status: 400,
      message: `GitHub App is not installed for ${owner}`,
      why: `No installation found for owner "${owner}"`,
      fix: `Install the GitHub App on ${owner} (or one of its repositories), then retry`,
    })
  }

  const ownerToken = await getAppInstallationToken(appCredentials, ownerInstallationId)
  const ownerOctokit = createAuthedOctokitWithToken(ownerToken)

  let created
  try {
    created = await ownerOctokit.repos.createInOrg({
      org: owner,
      name: repo,
      private: true,
      auto_init: true,
    })
  } catch {
    created = await ownerOctokit.repos.createForAuthenticatedUser({
      name: repo,
      private: true,
      auto_init: true,
    })
  }

  repoToken = await getGitHubAppInstallationTokenForRepo({
    repoPath,
    appId: appCredentials.appId,
    appPrivateKey: appCredentials.appPrivateKey,
  })

  const finalOctokit = createAuthedOctokitWithToken(repoToken || ownerToken)
  await ensureBranchExists(finalOctokit, repoPath, branch)
  await ensureSavoirMarker(finalOctokit, repoPath, branch)
  return {
    repository: mapRepository(created.data),
    created: true,
    adoptedExisting: false,
  }
}

/**
 * Ensures repository exists and target branch is available.
 * Uses explicit token first, then GitHub App credentials.
 */
export async function ensureRepositoryAndBranch(options: EnsureRepositoryOptions): Promise<EnsureRepositoryResult> {
  const repoPath = options.repoPath.trim()
  const branch = (options.branch || 'main').trim() || 'main'
  const allowExisting = options.allowExisting === true

  if (options.explicitToken) {
    return await ensureRepoWithAuthenticatedToken(options.explicitToken, repoPath, branch, allowExisting)
  }

  if (options.appId && options.appPrivateKey) {
    return await ensureRepoWithApp(
      { appId: options.appId, appPrivateKey: options.appPrivateKey },
      repoPath,
      branch,
      allowExisting,
    )
  }

  throw createError({
    status: 400,
    message: 'Cannot ensure snapshot repository automatically',
    why: 'No GitHub credentials configured for repository management',
    fix: 'Set NUXT_GITHUB_TOKEN or GitHub App credentials (NUXT_GITHUB_APP_ID and NUXT_GITHUB_APP_PRIVATE_KEY)',
  })
}
