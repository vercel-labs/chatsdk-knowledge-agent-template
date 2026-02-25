import { getToken, resolveGitHubAuth } from '@savoir/github/server/utils'
import { getSnapshotRepoConfig } from './sandbox/snapshot-config'

export async function getSnapshotToken(repoPath?: string): Promise<string | undefined> {
  const config = useRuntimeConfig()

  const auth = resolveGitHubAuth(config.github)
  if (!auth) return undefined

  const targetRepo = repoPath || (await getSnapshotRepoConfig()).snapshotRepo
  return getToken(auth, targetRepo)
}
