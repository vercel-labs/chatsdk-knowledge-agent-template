import { kv } from '@nuxthub/kv'
import { createError } from 'evlog'
import { KV_KEYS } from './types'

export interface SnapshotRepoConfig {
  snapshotRepo: string
  snapshotBranch: string
}

const SNAPSHOT_REPO_REGEX = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

function normalizeSnapshotRepo(value?: string | null): string {
  return (value || '').trim()
}

function normalizeSnapshotBranch(value?: string | null): string {
  const branch = (value || '').trim()
  return branch || 'main'
}

export function isValidSnapshotRepo(repo: string): boolean {
  return SNAPSHOT_REPO_REGEX.test(repo)
}

function validateSnapshotRepo(repo: string): void {
  if (!isValidSnapshotRepo(repo)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid snapshot repository format',
      data: {
        why: `Expected "owner/repo", received "${repo}"`,
        fix: 'Use the owner/repository format (for example: vercel-labs/savoir-snapshot)',
      },
    })
  }
}

export async function getSnapshotRepoConfig(): Promise<SnapshotRepoConfig> {
  const runtimeConfig = useRuntimeConfig()
  const stored = await kv.get<Partial<SnapshotRepoConfig>>(KV_KEYS.SNAPSHOT_REPO_CONFIG)

  const snapshotRepo = normalizeSnapshotRepo(stored?.snapshotRepo || runtimeConfig.github?.snapshotRepo)
  const snapshotBranch = normalizeSnapshotBranch(stored?.snapshotBranch || runtimeConfig.github?.snapshotBranch)

  return {
    snapshotRepo,
    snapshotBranch,
  }
}

export async function setSnapshotRepoConfig(input: {
  snapshotRepo: string
  snapshotBranch?: string
}): Promise<SnapshotRepoConfig> {
  const snapshotRepo = normalizeSnapshotRepo(input.snapshotRepo)
  const snapshotBranch = normalizeSnapshotBranch(input.snapshotBranch)

  validateSnapshotRepo(snapshotRepo)

  const nextConfig: SnapshotRepoConfig = {
    snapshotRepo,
    snapshotBranch,
  }

  await kv.set(KV_KEYS.SNAPSHOT_REPO_CONFIG, nextConfig)
  return nextConfig
}
