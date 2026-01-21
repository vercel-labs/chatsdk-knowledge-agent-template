import { getLogger } from '@savoir/logger'
import { FatalError } from 'workflow'
import type { GitHubSource } from '../utils/index.js'
import { getGitHubSources, getSourceById } from '../utils/index.js'

export async function getSourcesToSync(sourceFilter?: string): Promise<GitHubSource[]> {
  'use step'

  const logger = getLogger()
  let sources = await getGitHubSources()

  if (sourceFilter) {
    const source = await getSourceById(sourceFilter)
    if (!source || source.type !== 'github') {
      throw new FatalError(`Source not found: ${sourceFilter}`)
    }
    sources = [source as GitHubSource]
  }

  logger.log('sync', `Found ${sources.length} source(s) to sync`)
  return sources
}
