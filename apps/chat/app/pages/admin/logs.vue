<script setup lang="ts">
import { LazyModalConfirm } from '#components'

useSeoMeta({ title: 'Logs - Admin' })

const toast = useToast()
const overlay = useOverlay()

const { data: stats, refresh, status } = useLazyFetch<{ totalCount: number, oldestLog: string | null }>('/api/admin/logs')

const presets = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
]

const selectedDays = ref<number | null>(null)
const previewCount = ref<number | null>(null)
const isPreviewing = ref(false)
const isDeleting = ref(false)

const cutoffDate = computed(() => {
  if (!selectedDays.value) return null
  return new Date(Date.now() - selectedDays.value * 24 * 60 * 60 * 1000).toISOString()
})

const deleteModal = overlay.create(LazyModalConfirm, {
  props: {
    title: 'Delete logs',
    description: '',
  },
})

async function preview(days: number) {
  selectedDays.value = days
  previewCount.value = null
  isPreviewing.value = true
  try {
    const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const result = await $fetch<{ count: number }>('/api/admin/logs/count', { query: { before } })
    previewCount.value = result.count
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || 'Failed to count logs', color: 'error', icon: 'i-lucide-alert-circle' })
    selectedDays.value = null
  } finally {
    isPreviewing.value = false
  }
}

async function deleteLogs() {
  if (!cutoffDate.value || previewCount.value === null) return

  const instance = deleteModal.open({
    description: `This will permanently delete ${previewCount.value.toLocaleString()} log entries older than ${selectedDays.value} days. This cannot be undone.`,
  })
  const confirmed = await instance.result
  if (!confirmed) return

  isDeleting.value = true
  try {
    const result = await $fetch<{ deletedCount: number }>('/api/admin/logs', {
      method: 'DELETE',
      body: { before: cutoffDate.value },
    })
    toast.add({ title: `${result.deletedCount.toLocaleString()} logs deleted`, icon: 'i-lucide-check' })
    selectedDays.value = null
    previewCount.value = null
    await refresh()
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || 'Failed to delete logs', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="px-6 py-8 max-w-2xl mx-auto w-full">
    <header class="mb-8">
      <h1 class="text-lg font-medium text-highlighted mb-1 font-pixel tracking-wide">
        Logs
      </h1>
      <p class="text-sm text-muted max-w-lg">
        Monitor log volume and clean up old entries to free space.
      </p>
    </header>

    <div class="space-y-6">
      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          Overview
        </h2>
        <div class="rounded-lg border border-default p-4">
          <template v-if="status === 'pending'">
            <USkeleton class="h-8 w-40 mb-2" />
            <USkeleton class="h-4 w-56" />
          </template>
          <template v-else-if="stats">
            <p class="text-2xl font-medium text-highlighted tabular-nums">
              {{ stats.totalCount.toLocaleString() }}
            </p>
            <p class="text-sm text-muted mt-1">
              total log entries
              <span v-if="stats.oldestLog"> · oldest from {{ new Date(stats.oldestLog).toLocaleDateString() }}</span>
            </p>
          </template>
        </div>
      </section>

      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          Clean up
        </h2>
        <div class="rounded-lg border border-default p-4 space-y-4">
          <p class="text-sm text-muted">
            Delete logs older than:
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="preset in presets"
              :key="preset.days"
              :label="preset.label"
              size="xs"
              :color="selectedDays === preset.days ? 'primary' : 'neutral'"
              :variant="selectedDays === preset.days ? 'solid' : 'soft'"
              :loading="isPreviewing && selectedDays === preset.days"
              @click="preview(preset.days)"
            />
          </div>

          <div v-if="previewCount !== null && selectedDays" class="flex items-center justify-between gap-4 rounded-md bg-elevated px-4 py-3">
            <p class="text-sm">
              <span class="text-highlighted font-medium tabular-nums">{{ previewCount.toLocaleString() }}</span>
              <span class="text-muted"> logs older than {{ selectedDays }} days</span>
            </p>
            <UButton
              v-if="previewCount > 0"
              label="Delete"
              color="error"
              size="xs"
              :loading="isDeleting"
              @click="deleteLogs"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
