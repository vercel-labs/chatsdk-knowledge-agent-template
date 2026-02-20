<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { LazyModalConfirm } from '#components'

useSeoMeta({ title: 'Sandbox - Admin' })

const toast = useToast()
const overlay = useOverlay()
const { showError } = useErrorToast()
const confirmModal = overlay.create(LazyModalConfirm, { destroyOnClose: true })

const {
  status,
  needsSync,
  isSyncing,
  isLoading,
  checkStatus,
  syncNow,
} = useSnapshotSync()

const { data: snapshotConfig, refresh: refreshSnapshotConfig } = useLazyFetch('/api/snapshot/config')
const { fetchRepos } = useGitHub()
const { data: repoCatalog, status: repoCatalogStatus } = await fetchRepos()

const snapshotRepoInput = ref('')
const snapshotBranchInput = ref('main')
const isSavingConfig = ref(false)
const isRefreshingRepos = ref(false)
const selectedSuggestion = ref('')

const snapshotRepoUrl = computed(() => {
  const repo = snapshotConfig.value?.snapshotRepo?.trim()
  return repo ? `https://github.com/${repo}` : null
})

const filteredRepositorySuggestions = computed(() => {
  const repos = repoCatalog.value?.repositories || []
  return repos
})

const repositoryOptions = computed(() => {
  return filteredRepositorySuggestions.value.map(repo => ({
    label: repo.fullName,
    value: repo.fullName,
  }))
})

watch(snapshotConfig, (value) => {
  snapshotRepoInput.value = value?.snapshotRepo || ''
  snapshotBranchInput.value = value?.snapshotBranch || 'main'
}, { immediate: true })

const createdAgo = computed(() => {
  if (!status.value?.latestCreatedAt) return null
  return formatDistanceToNow(status.value.latestCreatedAt, { addSuffix: true })
})

const isInitialLoading = computed(() => status.value === null)

async function saveSnapshotConfig() {
  isSavingConfig.value = true
  try {
    await persistSnapshotConfig(false)

    await Promise.all([
      refreshSnapshotConfig(),
      checkStatus(),
    ])

    toast.add({
      title: 'Snapshot repository updated',
      description: 'Repository is ready. The active snapshot cache was reset; run sync to build the first snapshot.',
      icon: 'i-lucide-check',
    })
  } catch (error) {
    const status = getHttpStatus(error)
    if (status === 409) {
      const confirmed = await confirmModal.open({
        title: 'Use existing repository?',
        description: 'This repository already exists and is not marked as managed by Savoir. Confirm only if you want Savoir to adopt it.',
        confirmLabel: 'Adopt repository',
        cancelLabel: 'Cancel',
      })

      if (confirmed) {
        try {
          await persistSnapshotConfig(true)
          await Promise.all([
            refreshSnapshotConfig(),
            checkStatus(),
          ])
          toast.add({
            title: 'Repository adopted',
            description: 'Savoir will now use this existing repository for snapshots.',
            icon: 'i-lucide-check',
          })
          return
        } catch (secondError) {
          showError(secondError, { fallback: 'Failed to adopt existing repository' })
          return
        }
      }
      return
    }

    showError(error, { fallback: 'Failed to update snapshot repository' })
  } finally {
    isSavingConfig.value = false
  }
}

function getHttpStatus(error: unknown): number | null {
  const maybe = error as { statusCode?: number, response?: { status?: number } }
  return maybe.statusCode || maybe.response?.status || null
}

async function persistSnapshotConfig(allowExistingRepo: boolean) {
  await $fetch('/api/snapshot/config', {
    method: 'PUT',
    body: {
      snapshotRepo: snapshotRepoInput.value,
      snapshotBranch: snapshotBranchInput.value,
      allowExistingRepo,
    },
  })
}

function selectSuggestedRepo(fullName: string) {
  snapshotRepoInput.value = fullName
  selectedSuggestion.value = fullName
}

async function reloadRepositories() {
  isRefreshingRepos.value = true
  try {
    const fresh = await fetchRepos({ force: true })
    if (fresh.data.value) {
      repoCatalog.value = fresh.data.value
    }
  } finally {
    isRefreshingRepos.value = false
  }
}

watch(selectedSuggestion, (value) => {
  if (!value) return
  snapshotRepoInput.value = value
})
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
        Snapshot Repository
      </p>
      <div class="rounded-lg border border-default p-4 space-y-4">
        <p class="text-xs text-muted">
          This repository stores the aggregated docs that snapshots are created from. If it doesn't exist, Savoir creates it automatically.
        </p>

        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2 flex flex-col gap-1.5">
            <label class="text-xs text-muted">Repository (owner/repo)</label>
            <UInput
              v-model="snapshotRepoInput"
              placeholder="your-org/your-snapshot-repo"
              icon="i-simple-icons-github"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-muted">Branch</label>
            <UInput
              v-model="snapshotBranchInput"
              placeholder="main"
              icon="i-lucide-git-branch"
            />
          </div>
        </div>

        <div class="rounded-lg border border-default bg-elevated/30 p-3">
          <div class="flex items-center justify-between gap-2 mb-2">
            <p class="text-xs text-highlighted">
              Repository suggestions
            </p>
            <UTooltip text="Refresh repository list" :delay-open="150">
              <UButton
                size="xs"
                square
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="ghost"
                :loading="isRefreshingRepos || repoCatalogStatus === 'pending'"
                @click="reloadRepositories"
              />
            </UTooltip>
          </div>

          <p class="text-xs text-muted mb-2">
            Choose one from your accessible repositories, or type a new name above and Savoir will create it automatically.
          </p>

          <p
            v-if="repositoryOptions.length > 0"
            class="text-xs text-muted mb-2"
          >
            {{ repositoryOptions.length }} repositories available
          </p>

          <USelectMenu
            v-if="repositoryOptions.length > 0"
            v-model="selectedSuggestion"
            value-key="value"
            :items="repositoryOptions"
            :search-input="{ placeholder: 'Search repositories...' }"
            :virtualize="{ overscan: 16, estimateSize: 36 }"
            placeholder="Select a repository..."
            icon="i-simple-icons-github"
          />

          <div
            v-else-if="repoCatalogStatus !== 'pending' && repoCatalogStatus !== 'idle'"
            class="text-xs text-muted rounded-md border border-default bg-default px-3 py-2"
          >
            No repositories found with current GitHub credentials. You can still type a new `owner/repo` and save.
          </div>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            :loading="isSavingConfig"
            @click="saveSnapshotConfig"
          >
            Save
          </UButton>
          <UButton
            v-if="snapshotRepoUrl"
            icon="i-simple-icons-github"
            color="neutral"
            variant="ghost"
            size="xs"
            :to="snapshotRepoUrl"
            target="_blank"
          >
            Open Repository
          </UButton>
        </div>
      </div>
    </section>

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
          <UButton
            v-if="snapshotRepoUrl"
            icon="i-simple-icons-github"
            color="neutral"
            variant="link"
            size="xs"
            class="-ml-1.5"
            :to="snapshotRepoUrl"
            target="_blank"
          >
            Open Repository
          </UButton>
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
              @click="() => checkStatus()"
            >
              Refresh
            </UButton>
            <UButton
              v-if="needsSync"
              size="xs"
              :loading="isSyncing"
              @click="() => syncNow()"
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
