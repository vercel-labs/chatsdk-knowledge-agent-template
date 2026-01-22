// Define helper
export { defineConfig } from './define'

// Loader
export {
  loadSavoirConfig,
  setConfigCwd,
  setStaticConfig,
  getSources,
  getGitHubSources,
  getYouTubeSources,
  getCustomSources,
  getSourceById,
  getSourcesByType,
} from './loader'
export type { LoadOptions } from './loader'

// Types
export type {
  // Input types (for config files)
  SavoirConfigInput,
  GitHubSourceInput,
  YouTubeSourceInput,
  CustomSourceInput,
  // Normalized types (for runtime)
  Source,
  GitHubSource,
  YouTubeSource,
  CustomSource,
  ContentFile,
  LoadedConfig,
  // Sync types
  SyncResult,
  SyncConfig,
  SyncOptions,
  PushResult,
  SnapshotConfig,
} from './types'
