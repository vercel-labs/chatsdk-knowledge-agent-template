<script setup lang="ts">
import { LazyModalConfirm } from '#components'

interface SerializedSource {
  id: string
  type: 'github' | 'youtube'
  label: string
  repo: string | null
  branch: string | null
  contentPath: string | null
  outputPath: string | null
  readmeOnly: boolean | null
  channelId: string | null
  handle: string | null
  maxVideos: number | null
  createdAt: string
  updatedAt: string
}

definePageMeta({
  middleware: 'auth',
})

const toast = useToast()
const overlay = useOverlay()

const { data: sources, refresh } = await useFetch('/api/sources')

const showAddModal = ref(false)
const editingSource = ref<SerializedSource | null>(null)
const isSyncingAll = ref(false)

const deleteModal = overlay.create(LazyModalConfirm, {
  destroyOnClose: true,
})

async function deleteSource(source: SerializedSource) {
  const confirmed = await deleteModal.open({
    title: 'Delete Source',
    description: `Are you sure you want to delete "${source.label}"?`,
  })

  if (!confirmed) return

  try {
    await $fetch(`/api/sources/${source.id}`, { method: 'DELETE' })
    toast.add({
      title: 'Source deleted',
      icon: 'i-lucide-check',
    })
    refresh()
  } catch (error: unknown) {
    toast.add({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to delete source',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

async function triggerSync(sourceId?: string) {
  try {
    if (!sourceId) {
      isSyncingAll.value = true
    }
    await $fetch('/api/admin/sync', {
      method: 'POST',
      body: sourceId ? { sourceId } : {},
    })
    toast.add({
      title: sourceId ? 'Sync started' : 'Full sync started',
      description: 'The sync workflow has been triggered.',
      icon: 'i-lucide-check',
    })
  } catch (error: unknown) {
    toast.add({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to start sync',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    isSyncingAll.value = false
  }
}

function handleSaved() {
  refresh()
  showAddModal.value = false
  editingSource.value = null
}
</script>

<template>
  <UDashboardPanel id="admin-sources">
    <template #header>
      <DashboardNavbar />
    </template>

    <template #body>
      <UContainer class="py-10 max-w-3xl">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
          <div>
            <h1 class="text-2xl font-semibold text-highlighted tracking-tight">Sources</h1>
            <p class="text-muted text-sm mt-1">Manage your content sources for documentation sync</p>
          </div>
          <div class="flex gap-2">
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="isSyncingAll"
              :disabled="!sources?.github?.length && !sources?.youtube?.length"
              @click="triggerSync()"
            >
              Sync All
            </UButton>
            <UButton
              icon="i-lucide-plus"
              size="sm"
              @click="showAddModal = true"
            >
              Add Source
            </UButton>
          </div>
        </div>

        <div
          v-if="!sources?.github?.length && !sources?.youtube?.length"
          class="flex flex-col items-center justify-center py-16 px-4"
        >
          <div class="flex items-center justify-center size-12 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 mb-4">
            <UIcon name="i-lucide-database" class="size-6 text-muted" />
          </div>
          <h3 class="text-base font-medium text-highlighted mb-1">No sources configured</h3>
          <p class="text-sm text-muted text-center max-w-sm mb-6">
            Add your first source to start syncing documentation from GitHub repositories or YouTube channels.
          </p>
          <UButton
            icon="i-lucide-plus"
            size="sm"
            @click="showAddModal = true"
          >
            Add Source
          </UButton>
        </div>

        <template v-else>
          <section class="mb-8">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <UIcon name="i-simple-icons-github" class="size-4 text-muted" />
                <h2 class="text-sm font-medium text-highlighted">GitHub Repositories</h2>
                <span class="text-xs text-muted bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                  {{ sources?.github?.length || 0 }}
                </span>
              </div>
            </div>

            <div v-if="sources?.github?.length" class="space-y-2">
              <SourceCard
                v-for="source in sources.github"
                :key="source.id"
                :source
                @edit="editingSource = source"
                @delete="deleteSource(source)"
                @sync="triggerSync(source.id)"
              />
            </div>
            <button
              v-else
              class="w-full border border-dashed border-default hover:border-muted rounded-xl p-8 text-center transition-colors group"
              @click="showAddModal = true"
            >
              <p class="text-sm text-muted group-hover:text-highlighted transition-colors">
                Add a GitHub repository
              </p>
            </button>
          </section>

          <section>
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <UIcon name="i-simple-icons-youtube" class="size-4 text-red-500" />
                <h2 class="text-sm font-medium text-highlighted">YouTube Channels</h2>
                <span class="text-xs text-muted bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                  {{ sources?.youtube?.length || 0 }}
                </span>
              </div>
            </div>

            <div v-if="sources?.youtube?.length" class="space-y-2">
              <SourceCard
                v-for="source in sources.youtube"
                :key="source.id"
                :source
                @edit="editingSource = source"
                @delete="deleteSource(source)"
                @sync="triggerSync(source.id)"
              />
            </div>
            <button
              v-else
              class="w-full border border-dashed border-default hover:border-muted rounded-xl p-8 text-center transition-colors group"
              @click="showAddModal = true"
            >
              <p class="text-sm text-muted group-hover:text-highlighted transition-colors">
                Add a YouTube channel
              </p>
            </button>
          </section>
        </template>
      </UContainer>

      <SourceModal
        v-if="showAddModal || editingSource"
        :source="editingSource"
        @close="showAddModal = false; editingSource = null"
        @saved="handleSaved"
      />
    </template>
  </UDashboardPanel>
</template>
