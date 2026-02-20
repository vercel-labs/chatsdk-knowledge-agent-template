import { Octokit } from '@octokit/rest'

export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token })
}

export async function paginateAll<T>(
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
