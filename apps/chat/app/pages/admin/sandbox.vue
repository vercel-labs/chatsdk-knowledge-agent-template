<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'

const {
  status,
  needsSync,
  isSyncing,
  isLoading,
  checkStatus,
  syncNow,
} = useSnapshotSync()

const createdAgo = computed(() => {
  if (!status.value?.latestCreatedAt) return null
  return formatDistanceToNow(status.value.latestCreatedAt, { addSuffix: true })
})

const isInitialLoading = computed(() => status.value === null)
</script>

<template>
  <div class="px-6 py-8 max-w-2xl mx-auto w-full">
    <header class="mb-8">
      <h1 class="text-lg font-medium text-highlighted mb-1 font-pixel tracking-wide">
        Sandbox
      </h1>
      <p class="text-sm text-muted max-w-lg">
        Manage sandbox snapshots. Snapshots are pre-configured environments used by the AI to read documentation.
      </p>
    </header>

    <section class="mb-8">
      <p class="text-[10px] text-muted mb-3 font-pixel tracking-wide uppercase">
        Current Snapshot
      </p>
      <div class="rounded-lg border border-default p-4">
        <div v-if="isInitialLoading" class="space-y-2">
          <div class="flex items-center gap-2">
            <USkeleton class="size-2 rounded-full" />
            <USkeleton class="h-4 w-16" />
          </div>
          <USkeleton class="h-3 w-64" />
        </div>
        <div v-else-if="status?.currentSnapshotId" class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="size-2 rounded-full bg-success" />
            <span class="text-sm font-medium text-highlighted">Active</span>
          </div>
          <p class="text-xs text-muted font-mono">
            {{ status.currentSnapshotId }}
          </p>
        </div>
        <div v-else class="text-sm text-muted">
          No snapshot configured. Sync to the latest snapshot to get started.
        </div>
      </div>
    </section>

    <section class="mb-8">
      <p class="text-[10px] text-muted mb-3 font-pixel tracking-wide uppercase">
        Latest Available
      </p>
      <div class="rounded-lg border border-default p-4">
        <div class="flex items-center justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div v-if="isInitialLoading" class="space-y-2">
              <div class="flex items-center gap-2">
                <USkeleton class="size-2 rounded-full" />
                <USkeleton class="h-4 w-24" />
              </div>
              <USkeleton class="h-3 w-64" />
              <USkeleton class="h-3 w-32" />
            </div>
            <div v-else-if="status?.latestSnapshotId" class="space-y-2">
              <div class="flex items-center gap-2">
                <span
                  class="size-2 rounded-full"
                  :class="needsSync ? 'bg-warning' : 'bg-success'"
                />
                <span class="text-sm font-medium text-highlighted">
                  {{ needsSync ? 'Update available' : 'Up to date' }}
                </span>
              </div>
              <p class="text-xs text-muted font-mono">
                {{ status.latestSnapshotId }}
              </p>
              <p v-if="createdAgo" class="text-xs text-muted">
                Created {{ createdAgo }}
              </p>
            </div>
            <div v-else class="text-sm text-muted">
              No snapshots available from Vercel.
            </div>
          </div>
          <div v-if="!isInitialLoading" class="flex items-center gap-2">
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="xs"
              :loading="isLoading"
              @click="checkStatus"
            >
              Refresh
            </UButton>
            <UButton
              v-if="needsSync"
              size="xs"
              :loading="isSyncing"
              @click="syncNow"
            >
              Sync now
            </UButton>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="rounded-lg bg-elevated/50 p-4 text-xs text-muted space-y-2">
        <p>
          <strong class="text-highlighted">How it works:</strong>
          Snapshots are pre-built sandbox environments created from your documentation repositories.
        </p>
        <p>
          When a new snapshot is created on Vercel, it will be synced automatically.
        </p>
      </div>
    </section>
  </div>
</template>
