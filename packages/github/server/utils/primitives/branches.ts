import { isNotFoundError } from './repos'
import { createOctokit } from './utils'

export interface BranchInfo {
  name: string
  sha: string
}

export async function getBranch(owner: string, repo: string, branch: string, token: string): Promise<BranchInfo> {
  const octokit = createOctokit(token)
  const result = await octokit.repos.getBranch({ owner, repo, branch })
  return {
    name: result.data.name,
    sha: result.data.commit.sha,
  }
}

export async function createBranch(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  options: { fromBranch?: string; fromSha?: string } = {},
): Promise<BranchInfo> {
  const octokit = createOctokit(token)

  let sha = options.fromSha
  if (!sha) {
    if (options.fromBranch) {
      const ref = await octokit.git.getRef({ owner, repo, ref: `heads/${options.fromBranch}` })
      ;({ sha } = ref.data.object)
    } else {
      const repoInfo = await octokit.repos.get({ owner, repo })
      const ref = await octokit.git.getRef({ owner, repo, ref: `heads/${repoInfo.data.default_branch}` })
      ;({ sha } = ref.data.object)
    }
  }

  const result = await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha,
  })

  return {
    name: branch,
    sha: result.data.object.sha,
  }
}

export async function ensureBranch(
  owner: string,
  repo: string,
  branch: string,
  token: string,
): Promise<BranchInfo> {
  try {
    return await getBranch(owner, repo, branch, token)
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return await createBranch(owner, repo, branch, token)
    }
    throw error
  }
}
