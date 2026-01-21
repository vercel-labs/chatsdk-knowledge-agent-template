import { defineHandler } from 'nitro/h3'
import { getSources, getGitHubSources, getYouTubeSources } from '~/workflows/sync-docs'

/**
 * GET /api/sources
 * Returns the list of configured content sources
 */
export default defineHandler(async () => {
  const github = (await getGitHubSources()).map((s) => ({
    id: s.id,
    label: s.label,
    type: s.type,
    repo: s.repo,
    branch: s.branch,
    outputPath: s.outputPath || s.id,
    readmeOnly: s.readmeOnly || false,
  }))

  const youtube = (await getYouTubeSources()).map((s) => ({
    id: s.id,
    label: s.label,
    type: s.type,
    channelId: s.channelId,
    handle: s.handle,
  }))

  return {
    total: (await getSources()).length,
    github: {
      count: github.length,
      sources: github,
    },
    youtube: {
      count: youtube.length,
      sources: youtube,
    },
  }
})
