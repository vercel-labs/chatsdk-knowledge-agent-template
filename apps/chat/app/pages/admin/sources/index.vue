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
  layout: 'admin',
  middleware: 'admin',
})

const toast = useToast()
const overlay = useOverlay()

const { data: sources, refresh } = await useFetch('/api/sources')

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
    const endpoint = sourceId ? `/api/sync/${sourceId}` : '/api/sync'
    await $fetch(endpoint, { method: 'POST' })
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
  editingSource.value = null
}
</script>

<template>
  <UContainer class="py-10 max-w-xl">
    <header class="mb-10">
      <div class="flex items-center justify-between">
        <h1 class="text-lg font-semibold text-highlighted">
          Sources
        </h1>
        <div class="flex items-center gap-1.5">
          <UButton
            v-if="sources?.github?.count || sources?.youtube?.count"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="ghost"
            size="xs"
            :loading="isSyncingAll"
            @click="triggerSync()"
          >
            Sync All
          </UButton>
          <UButton
            icon="i-lucide-plus"
            size="xs"
            to="/admin/sources/new"
          >
            Add
          </UButton>
        </div>
      </div>
      <p class="text-[13px] text-muted mt-1">
        Configure sources for documentation sync
      </p>
    </header>

    <div
      v-if="!sources?.github?.count && !sources?.youtube?.count"
      class="flex flex-col items-center py-16 border border-dashed border-default rounded-xl"
    >
      <div class="size-10 rounded-lg bg-muted flex items-center justify-center mb-3">
        <UIcon name="i-lucide-layers" class="size-5 text-muted" />
      </div>
      <p class="text-sm font-medium text-highlighted mb-1">
        No sources yet
      </p>
      <p class="text-[13px] text-muted mb-4">
        Add a source to get started
      </p>
      <UButton
        icon="i-lucide-plus"
        size="sm"
        to="/admin/sources/new"
      >
        Add Source
      </UButton>
    </div>

    <div v-else class="space-y-8">
      <section>
        <header class="flex items-center gap-2 mb-2">
          <UIcon name="i-simple-icons-github" class="size-4 text-muted" />
          <h2 class="text-[13px] font-medium text-muted">
            GitHub
          </h2>
          <span class="text-[13px] text-muted/60">{{ sources?.github?.count || 0 }}</span>
        </header>

        <div
          v-if="sources?.github?.count"
          class="rounded-lg border border-default bg-default divide-y divide-default"
        >
          <div v-for="source in sources.github.sources" :key="source.id" class="px-4">
            <SourceCard
              :source
              @edit="editingSource = source"
              @delete="deleteSource(source)"
              @sync="triggerSync(source.id)"
            />
          </div>
        </div>
        <UButton
          v-else
          variant="ghost"
          class="w-full h-24 rounded-lg border border-dashed border-default hover:border-muted"
          to="/admin/sources/new"
        >
          <span class="text-[13px] text-muted">Add a repository</span>
        </UButton>
      </section>

      <section>
        <header class="flex items-center gap-2 mb-2">
          <UIcon name="i-simple-icons-youtube" class="size-4 text-red-500" />
          <h2 class="text-[13px] font-medium text-muted">
            YouTube
          </h2>
          <span class="text-[13px] text-muted/60">{{ sources?.youtube?.count || 0 }}</span>
        </header>

        <div
          v-if="sources?.youtube?.count"
          class="rounded-lg border border-default bg-default divide-y divide-default"
        >
          <div v-for="source in sources.youtube.sources" :key="source.id" class="px-4">
            <SourceCard
              :source
              @edit="editingSource = source"
              @delete="deleteSource(source)"
              @sync="triggerSync(source.id)"
            />
          </div>
        </div>
        <UButton
          v-else
          variant="ghost"
          class="w-full h-24 rounded-lg border border-dashed border-default hover:border-muted"
          to="/admin/sources/new"
        >
          <span class="text-[13px] text-muted">Add a channel</span>
        </UButton>
      </section>
    </div>
  </UContainer>

  <SourceModal
    v-if="editingSource"
    :source="editingSource"
    @close="editingSource = null"
    @saved="handleSaved"
  />
</template>
