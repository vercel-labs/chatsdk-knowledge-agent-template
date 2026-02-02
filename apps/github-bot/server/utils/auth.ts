import { createSign } from 'node:crypto'

const tokenCache = new Map<number, { token: string, expiresAt: Date }>()
const installationIdCache = new Map<string, number>()

function generateAppJWT(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  }

  const header = { alg: 'RS256', typ: 'JWT' }
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url')
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')

  const signatureInput = `${headerB64}.${payloadB64}`
  const sign = createSign('RSA-SHA256')
  sign.update(signatureInput)
  const signature = sign.sign(privateKey, 'base64url')

  return `${headerB64}.${payloadB64}.${signature}`
}

async function getInstallationId(
  appId: string,
  privateKey: string,
  owner: string,
  repo: string,
): Promise<number> {
  const jwt = generateAppJWT(appId, privateKey)

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/installation`,
    {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get installation: ${response.status} ${error}`)
  }

  const data = await response.json() as { id: number }
  return data.id
}

async function getInstallationToken(
  appId: string,
  privateKey: string,
  installationId: number,
): Promise<string> {
  const cached = tokenCache.get(installationId)
  if (cached && cached.expiresAt > new Date(Date.now() + 60000)) {
    return cached.token
  }

  const jwt = generateAppJWT(appId, privateKey)

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get installation token: ${response.status} ${error}`)
  }

  const data = await response.json() as { token: string, expires_at: string }

  tokenCache.set(installationId, {
    token: data.token,
    expiresAt: new Date(data.expires_at),
  })

  return data.token
}

export interface GitHubAuth {
  getToken: (owner: string, repo: string) => Promise<string>
}

export function createGitHubAuth(appId: string, privateKey: string): GitHubAuth {
  return {
    async getToken(owner: string, repo: string): Promise<string> {
      const cacheKey = `${owner}/${repo}`

      let installationId = installationIdCache.get(cacheKey)
      if (!installationId) {
        installationId = await getInstallationId(appId, privateKey, owner, repo)
        installationIdCache.set(cacheKey, installationId)
      }

      return getInstallationToken(appId, privateKey, installationId)
    },
  }
}
