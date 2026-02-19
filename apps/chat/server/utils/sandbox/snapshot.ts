import { kv } from '@nuxthub/kv'
import { createError } from 'evlog'
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
    throw createError({
      message: 'No snapshot available',
      why: 'No sandbox snapshot has been created yet',
      fix: 'Create a snapshot first by running the sync workflow or using the admin panel',
    })
  }
  return snapshot.snapshotId
}
