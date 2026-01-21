// Types and sources from @savoir/config
export type {
  Source,
  GitHubSource,
  YouTubeSource,
  CustomSource,
  ContentFile,
  SyncResult,
  SnapshotConfig,
  SyncConfig,
  SyncOptions,
  PushResult,
} from '@savoir/config'

export {
  getSources,
  getGitHubSources,
  getYouTubeSources,
  getSourceById,
  getSourcesByType,
} from '@savoir/config'

// GitHub sync functions
export {
  syncGitHubSource,
  resetSourceDir,
  cleanupNonDocFiles,
  fetchReadme,
  collectFiles,
} from './github.js'

// Snapshot
export { pushToSnapshot } from './snapshot.js'
