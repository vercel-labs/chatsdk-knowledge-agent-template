export type {
  ActiveSandbox,
  FileContent,
  SandboxManagerConfig,
  SandboxSession,
  SearchAndReadResult,
  SearchResult,
  SnapshotMetadata,
} from './types'

export {
  deleteSession,
  generateSessionId,
  getSession,
  setSession,
  touchSession,
} from './session'

export {
  getCurrentSnapshot,
  getSnapshotIdOrThrow,
  hasSnapshot,
  setCurrentSnapshot,
} from './snapshot'

export {
  createSnapshotFromRepo,
  getOrCreateSandbox,
  read,
  search,
  searchAndRead,
} from './manager'

export { createGitSource, createSandbox, generateAuthRepoUrl } from './context'

export type { GitConfig, GitPushOptions, GitPushResult } from './git'
export {
  addFiles,
  checkoutBranch,
  commit,
  configureGit,
  generateCommitMessage,
  hasChanges,
  push,
  pushChanges,
} from './git'

export { syncGitHubSource, syncSources } from './source-sync'
