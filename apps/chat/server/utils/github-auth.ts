import { getToken, resolveGitHubAuth } from '@savoir/github/server/utils'
import { getSnapshotRepoConfig } from './sandbox/snapshot-config'

export async function getSnapshotToken(): Promise<string | undefined> {
  const config = useRuntimeConfig()
  const snapshotConfig = await getSnapshotRepoConfig()

  const auth = resolveGitHubAuth(config.github)
  if (!auth) return undefined

  return getToken(auth, snapshotConfig.snapshotRepo)
}
