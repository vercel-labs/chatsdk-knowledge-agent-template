export interface SnapshotSyncStatus {
  currentSnapshotId: string | null
  latestSnapshotId: string | null
  needsSync: boolean
  latestCreatedAt: number | null
}
