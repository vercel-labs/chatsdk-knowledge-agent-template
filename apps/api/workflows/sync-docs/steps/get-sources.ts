import { getLogger } from '@savoir/logger'
import { FatalError } from 'workflow'
import type { DBSource, GitHubSource } from '../utils/index.js'
import { getGitHubSources, getSourceById } from '../utils/index.js'

/**
 * Normalize a DB source to a GitHubSource
 */
function normalizeGitHubSource(source: DBSource): GitHubSource {
  return {
    id: source.id,
    type: 'github',
    label: source.label,
    repo: source.repo || '',
    branch: source.branch || 'main',
    contentPath: source.contentPath || '',
    outputPath: source.outputPath || source.id,
    readmeOnly: source.readmeOnly ?? false,
    additionalSyncs: [],
  }
}

interface GetSourcesOptions {
  sourceFilter?: string
  /** Sources passed directly from DB */
  sources?: DBSource[]
}

export async function getSourcesToSync(options: GetSourcesOptions = {}): Promise<GitHubSource[]> {
  'use step'

  const logger = getLogger()
  const { sourceFilter, sources: dbSources } = options

  let sources: GitHubSource[]

  // If sources are passed from DB, use them directly
  if (dbSources && dbSources.length > 0) {
    // Filter to GitHub sources only and normalize
    sources = dbSources
      .filter(s => s.type === 'github')
      .map(normalizeGitHubSource)

    logger.log('sync', `Using ${sources.length} source(s) from DB`)
  } else {
    // Fall back to loading from config file
    sources = await getGitHubSources()
    logger.log('sync', `Loaded ${sources.length} source(s) from config`)
  }

  // Apply filter if specified
  if (sourceFilter) {
    const filteredSource = sources.find(s => s.id === sourceFilter)
    if (!filteredSource) {
      // Try loading from config as fallback
      const source = await getSourceById(sourceFilter)
      if (!source || source.type !== 'github') {
        throw new FatalError(`Source not found: ${sourceFilter}`)
      }
      sources = [source as GitHubSource]
    } else {
      sources = [filteredSource]
    }
  }

  logger.log('sync', `Found ${sources.length} source(s) to sync`)
  return sources
}
