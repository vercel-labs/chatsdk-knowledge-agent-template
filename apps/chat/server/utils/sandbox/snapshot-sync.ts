import { kv } from '@nuxthub/kv'
import { Snapshot } from '@vercel/sandbox'
import { createError } from 'evlog'
import type { SnapshotMetadata, SnapshotSyncStatus } from './types'
import { KV_KEYS } from './types'
import { getCurrentSnapshot, setCurrentSnapshot } from './snapshot'

const CACHE_TTL_MS = 60 * 1000

interface CachedSnapshotStatus {
  latestSnapshotId: string | null
  latestCreatedAt: number | null
  cachedAt: number
}

interface VercelSnapshot {
  id: string
  region: string
  status: 'failed' | 'created' | 'deleted'
  createdAt: number
  updatedAt: number
  sourceSandboxId: string
  sizeBytes: number
  expiresAt: number
}

export async function listSnapshots(): Promise<VercelSnapshot[]> {
  const result = await Snapshot.list()
  return result.json.snapshots
}

export async function getLatestSnapshot(): Promise<VercelSnapshot | null> {
  const snapshots = await listSnapshots()

  const validSnapshots = snapshots
    .filter((s: VercelSnapshot) => s.status === 'created')
    .sort((a: VercelSnapshot, b: VercelSnapshot) => b.createdAt - a.createdAt)

  return validSnapshots[0] ?? null
}

async function getCachedLatestSnapshot(): Promise<CachedSnapshotStatus> {
  const cached = await kv.get<CachedSnapshotStatus>(KV_KEYS.SNAPSHOT_STATUS_CACHE)

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached
  }

  const latest = await getLatestSnapshot()
  const freshCache: CachedSnapshotStatus = {
    latestSnapshotId: latest?.id ?? null,
    latestCreatedAt: latest?.createdAt ?? null,
    cachedAt: Date.now(),
  }

  await kv.set(KV_KEYS.SNAPSHOT_STATUS_CACHE, freshCache)

  return freshCache
}

export async function getSnapshotSyncStatus(): Promise<SnapshotSyncStatus> {
  const [current, cached] = await Promise.all([
    getCurrentSnapshot(),
    getCachedLatestSnapshot(),
  ])

  const currentSnapshotId = current?.snapshotId ?? null
  const { latestSnapshotId, latestCreatedAt } = cached
  const needsSync = latestSnapshotId !== null && latestSnapshotId !== currentSnapshotId

  return {
    currentSnapshotId,
    latestSnapshotId,
    needsSync,
    latestCreatedAt,
  }
}

export async function syncToSnapshot(snapshotId?: string): Promise<SnapshotMetadata> {
  let targetSnapshotId = snapshotId

  if (!targetSnapshotId) {
    const latest = await getLatestSnapshot()
    if (!latest) {
      throw createError({
        message: 'No snapshots available to sync to',
        why: 'No valid snapshots exist on the Vercel sandbox platform',
        fix: 'Run the sync workflow to create a snapshot first',
      })
    }
    targetSnapshotId = latest.id
  }

  const snapshot = await Snapshot.get({ snapshotId: targetSnapshotId })
  const config = useRuntimeConfig()

  const metadata: SnapshotMetadata = {
    snapshotId: snapshot.snapshotId,
    createdAt: Date.now(),
    sourceRepo: config.github.snapshotRepo || '',
  }

  await setCurrentSnapshot(metadata)
  await kv.del(KV_KEYS.SNAPSHOT_STATUS_CACHE)

  return metadata
}
