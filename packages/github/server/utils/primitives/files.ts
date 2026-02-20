import { isNotFoundError } from './repos'
import { createOctokit } from './utils'

export interface FileContent {
  content: string
  sha: string
  encoding: 'utf8'
}

export async function getFile(
  owner: string,
  repo: string,
  path: string,
  token: string,
  options: { ref?: string } = {},
): Promise<FileContent | null> {
  const octokit = createOctokit(token)

  try {
    const response = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref: options.ref,
    })

    if (Array.isArray(response.data) || response.data.type !== 'file') {
      return null
    }

    return {
      content: Buffer.from(response.data.content, 'base64').toString('utf8'),
      sha: response.data.sha,
      encoding: 'utf8',
    }
  } catch (error: unknown) {
    if (isNotFoundError(error)) return null
    throw error
  }
}

export async function createOrUpdateFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  token: string,
  options: { branch?: string; message?: string; sha?: string } = {},
): Promise<{ sha: string; committed: boolean }> {
  const octokit = createOctokit(token)

  const response = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: options.message || `Update ${path}`,
    content: Buffer.from(content).toString('base64'),
    branch: options.branch,
    sha: options.sha,
  })

  return {
    sha: response.data.content?.sha || '',
    committed: true,
  }
}
