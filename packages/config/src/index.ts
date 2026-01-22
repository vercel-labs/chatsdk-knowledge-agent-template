export { defineConfig } from './define'

export {
  loadSavoirConfig,
  setConfigCwd,
  getSources,
  getGitHubSources,
  getYouTubeSources,
  getCustomSources,
  getSourceById,
  getSourcesByType,
} from './loader'
export type { LoadOptions } from './loader'

export type {
  SavoirConfigInput,
  GitHubSourceInput,
  YouTubeSourceInput,
  CustomSourceInput,
  Source,
  GitHubSource,
  YouTubeSource,
  CustomSource,
  ContentFile,
  LoadedConfig,
  SyncResult,
  SyncConfig,
  SyncOptions,
  PushResult,
  SnapshotConfig,
  DBSource,
} from './types'
