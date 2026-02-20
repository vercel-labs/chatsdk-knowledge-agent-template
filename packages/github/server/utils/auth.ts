import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'

/** Credentials: either PAT or GitHub App */
export type GitHubAuth =
  | { type: 'pat'; token: string }
  | { type: 'app'; appId: string; appPrivateKey: string }

type TokenCacheEntry = {
  token: string
  expiresAt: number
}

const tokenCache = new Map<string, TokenCacheEntry>()
const DEFAULT_TOKEN_TTL_MS = 50 * 60 * 1000

export function decodeGitHubPrivateKey(rawKey: string): string {
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

export function createAppOctokit(appId: string, appPrivateKey: string): Octokit | null {
  if (!appId || !appPrivateKey) {
    return null
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey: decodeGitHubPrivateKey(appPrivateKey),
    },
  })
}

async function createInstallationTokenForId(appId: string, appPrivateKey: string, installationId: number): Promise<string> {
  const auth = createAppAuth({
    appId,
    privateKey: decodeGitHubPrivateKey(appPrivateKey),
  })

  const { token } = await auth({
    type: 'installation',
    installationId,
  })
  return token
}

export async function getAppInstallationToken(appId: string, appPrivateKey: string, installationId: number): Promise<string> {
  const cacheKey = `app-installation:${appId}:${installationId}`
  const cached = getCachedToken(cacheKey)
  if (cached) {
    return cached
  }

  const token = await createInstallationTokenForId(appId, appPrivateKey, installationId)
  setCachedToken(cacheKey, token)
  return token
}

async function getAppInstallationForRepo(
  appId: string,
  appPrivateKey: string,
  owner: string,
  repo: string,
): Promise<number | null> {
  const appOctokit = createAppOctokit(appId, appPrivateKey)
  if (!appOctokit) return null

  try {
    const installation = await appOctokit.apps.getRepoInstallation({ owner, repo })
    return installation.data.id
  } catch {
    return null
  }
}

export async function getAppInstallationForOwner(
  appId: string,
  appPrivateKey: string,
  owner: string,
): Promise<number | null> {
  const appOctokit = createAppOctokit(appId, appPrivateKey)
  if (!appOctokit) return null

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
 * Get an App installation token for a specific repo. Returns undefined if not installed.
 */
export async function getAppTokenForRepo(options: {
  appId: string
  appPrivateKey: string
  repoPath: string
}): Promise<string | undefined> {
  if (!options.appId || !options.appPrivateKey || !options.repoPath) {
    return undefined
  }

  const [owner, repo] = options.repoPath.split('/')
  if (!owner || !repo) return undefined

  const installationId = await getAppInstallationForRepo(options.appId, options.appPrivateKey, owner, repo)
  if (!installationId) {
    return undefined
  }

  return await getAppInstallationToken(options.appId, options.appPrivateKey, installationId)
}

/**
 * Build a GitHubAuth from runtime config values. Returns null if no credentials are configured.
 */
export function resolveGitHubAuth(config: { token?: string; appId?: string; appPrivateKey?: string }): GitHubAuth | null {
  if (config.token) {
    return { type: 'pat', token: config.token }
  }
  if (config.appId && config.appPrivateKey) {
    return { type: 'app', appId: config.appId, appPrivateKey: config.appPrivateKey }
  }
  return null
}

/**
 * Resolve a token for a given repo (for cloning, push, etc.). PAT returns as-is; App fetches installation token.
 */
export async function getToken(auth: GitHubAuth, repoPath?: string): Promise<string | undefined> {
  if (auth.type === 'pat') {
    return auth.token
  }

  if (auth.type === 'app' && repoPath) {
    return await getAppTokenForRepo({
      appId: auth.appId,
      appPrivateKey: auth.appPrivateKey,
      repoPath,
    })
  }

  return undefined
}
