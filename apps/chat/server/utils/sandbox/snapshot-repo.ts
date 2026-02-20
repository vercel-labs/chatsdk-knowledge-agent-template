import { createError } from 'evlog'
import { getRepo, createRepo, ensureBranch, getFile, createOrUpdateFile, isNotFoundError, type RepoInfo, parseRepoPath } from '@savoir/github/server/utils'

const SAVOIR_MARKER_PATH = '.savoir/snapshot-repo.json'
const SAVOIR_MARKER_VERSION = 1

export async function hasSavoirMarker(
  token: string,
  repoPath: string,
  branch: string,
): Promise<boolean> {
  const { owner, repo } = parseRepoPath(repoPath)
  const file = await getFile(owner, repo, SAVOIR_MARKER_PATH, token, { ref: branch })
  return file !== null
}

export async function ensureSavoirMarker(
  token: string,
  repoPath: string,
  branch: string,
): Promise<void> {
  const { owner, repo } = parseRepoPath(repoPath)
  const markerContent = {
    managedBy: 'savoir',
    version: SAVOIR_MARKER_VERSION,
    createdAt: new Date().toISOString(),
  }

  const existing = await getFile(owner, repo, SAVOIR_MARKER_PATH, token, { ref: branch })

  await createOrUpdateFile(
    owner,
    repo,
    SAVOIR_MARKER_PATH,
    JSON.stringify(markerContent, null, 2),
    token,
    {
      branch,
      message: existing
        ? 'chore: refresh savoir snapshot marker'
        : 'chore: initialize savoir snapshot marker',
      sha: existing?.sha,
    },
  )
}

export interface EnsureSnapshotRepoResult {
  repository: RepoInfo
  created: boolean
  adoptedExisting: boolean
}

export async function ensureSnapshotRepo(options: {
  repoPath: string
  branch?: string
  allowExisting?: boolean
  token: string
}): Promise<EnsureSnapshotRepoResult> {
  const repoPath = options.repoPath.trim()
  const branch = (options.branch || 'main').trim() || 'main'
  const allowExisting = options.allowExisting === true
  const { token } = options

  const { owner, repo } = parseRepoPath(repoPath)

  try {
    const repository = await getRepo(owner, repo, token)

    await ensureBranch(owner, repo, branch, token)
    const hasMarker = await hasSavoirMarker(token, repoPath, branch)

    if (!hasMarker && !allowExisting) {
      throw createError({
        status: 409,
        message: 'Repository already exists and is not managed by Savoir',
        why: `The repository ${repoPath} exists but has no ${SAVOIR_MARKER_PATH} marker`,
        fix: 'Confirm adoption explicitly, or choose a new repository name',
      })
    }

    if (!hasMarker) {
      await ensureSavoirMarker(token, repoPath, branch)
    }

    return {
      repository,
      created: false,
      adoptedExisting: !hasMarker,
    }
  } catch (error: unknown) {
    if (!isNotFoundError(error)) throw error
  }

  const createdRepo = await createRepo({ name: repo, owner }, token)
  await ensureBranch(owner, repo, branch, token)
  await ensureSavoirMarker(token, repoPath, branch)

  return {
    repository: createdRepo,
    created: true,
    adoptedExisting: false,
  }
}
