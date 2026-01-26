import { kv } from '@nuxthub/kv'
import type { SnapshotMetadata } from './types'
import { KV_KEYS } from './types'

/** Returns current snapshot metadata from KV, null if none exists */
export async function getCurrentSnapshot(): Promise<SnapshotMetadata | null> {
  return await kv.get<SnapshotMetadata>(KV_KEYS.CURRENT_SNAPSHOT)
}

/** Stores snapshot metadata as current snapshot in KV */
export async function setCurrentSnapshot(metadata: SnapshotMetadata): Promise<void> {
  await kv.set(KV_KEYS.CURRENT_SNAPSHOT, metadata)
}

/** Returns true if a snapshot exists in KV */
export async function hasSnapshot(): Promise<boolean> {
  const snapshot = await getCurrentSnapshot()
  return snapshot !== null
}

/** Returns current snapshot ID, throws if no snapshot exists */
export async function getSnapshotIdOrThrow(): Promise<string> {
  const snapshot = await getCurrentSnapshot()
  if (!snapshot) {
    throw new Error('No snapshot available. Please create a snapshot first.')
  }
  return snapshot.snapshotId
}
