import type { RepoInfo } from '../server/utils'

interface ReposResponse {
  count: number
  repositories: RepoInfo[]
}

export function useGitHub() {
  const fetchRepos = (options: { force?: boolean } = {}) => {
    return useFetch<ReposResponse>('/api/github/repos', {
      query: { force: options.force },
    })
  }

  return { fetchRepos }
}
