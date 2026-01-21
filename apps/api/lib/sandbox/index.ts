// Types
export type {
  ActiveSandbox,
  FileContent,
  SandboxManagerConfig,
  SandboxSession,
  SearchAndReadResult,
  SearchResult,
  SnapshotMetadata,
} from './types'

// Session management
export {
  deleteSession,
  generateSessionId,
  getSession,
  setSession,
  touchSession,
} from './session'

// Snapshot management
export {
  getCurrentSnapshot,
  getSnapshotIdOrThrow,
  hasSnapshot,
  setCurrentSnapshot,
} from './snapshot'

// Sandbox operations
export {
  createSnapshotFromRepo,
  getOrCreateSandbox,
  read,
  search,
  searchAndRead,
} from './manager'
