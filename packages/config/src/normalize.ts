import type {
  GitHubSourceInput,
  YouTubeSourceInput,
  CustomSourceInput,
  GitHubSource,
  YouTubeSource,
  CustomSource,
} from './types'

/**
 * Capitalize the first letter of each word
 */
function capitalize(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Normalize a GitHub source input by applying defaults
 */
export function normalizeGitHubSource(input: GitHubSourceInput): GitHubSource {
  return {
    type: 'github',
    id: input.id,
    label: input.label ?? capitalize(input.id),
    repo: input.repo,
    branch: input.branch ?? 'main',
    contentPath: input.contentPath ?? 'docs',
    outputPath: input.outputPath ?? input.id,
    readmeOnly: input.readmeOnly ?? false,
    additionalSyncs: (input.additionalSyncs ?? []).map(sync => ({
      repo: sync.repo,
      branch: sync.branch ?? 'main',
      contentPath: sync.contentPath ?? '',
    })),
  }
}

/**
 * Normalize a YouTube source input by applying defaults
 */
export function normalizeYouTubeSource(input: YouTubeSourceInput): YouTubeSource {
  return {
    type: 'youtube',
    id: input.id,
    label: input.label ?? capitalize(input.id),
    channelId: input.channelId,
    handle: input.handle,
    maxVideos: input.maxVideos ?? 50,
  }
}

/**
 * Normalize a custom source input by applying defaults
 */
export function normalizeCustomSource(input: CustomSourceInput): CustomSource {
  return {
    type: 'custom',
    id: input.id,
    label: input.label ?? capitalize(input.id),
    fetchFn: input.fetchFn,
  }
}
