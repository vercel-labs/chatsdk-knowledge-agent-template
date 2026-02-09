import type { SnapshotSyncStatus } from '~~/shared/types/snapshot'

const POLL_INTERVAL_MS = 5 * 60 * 1000

const status = shallowRef<SnapshotSyncStatus | null>(null)
const isSyncing = shallowRef(false)
const isLoading = shallowRef(false)
const error = shallowRef<string | null>(null)
const isInitialized = shallowRef(false)

let pollInterval: ReturnType<typeof setInterval> | null = null

export function useSnapshotSync() {
  const { isAdmin } = useAdmin()
  const toast = useToast()

  const needsSync = computed(() => status.value?.needsSync ?? false)

  async function syncNow() {
    if (!isAdmin.value || isSyncing.value) return

    isSyncing.value = true
    error.value = null

    try {
      await $fetch('/api/snapshot/sync', { method: 'POST' })

      toast.add({
        title: 'Snapshot synced',
        description: 'The application is now using the latest snapshot.',
        icon: 'i-lucide-check-circle',
        color: 'success',
      })

      await checkStatus(false)
    } catch (e) {
      const message = (e as Error).message || 'Failed to sync snapshot'
      error.value = message
      toast.add({
        title: 'Sync failed',
        description: message,
        icon: 'i-lucide-alert-circle',
        color: 'error',
      })
    } finally {
      isSyncing.value = false
    }
  }

  async function checkStatus(autoSync = true) {
    if (!isAdmin.value) return

    isLoading.value = true
    error.value = null

    try {
      const newStatus = await $fetch<SnapshotSyncStatus>('/api/snapshot/status')
      status.value = newStatus

      if (autoSync && newStatus.needsSync && !isSyncing.value) {
        await syncNow()
      }
    } catch (e) {
      error.value = (e as Error).message || 'Failed to check snapshot status'
    } finally {
      isLoading.value = false
    }
  }

  function startPolling() {
    if (pollInterval) return
    pollInterval = setInterval(() => checkStatus(true), POLL_INTERVAL_MS)
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  onMounted(() => {
    if (isInitialized.value) return
    isInitialized.value = true

    watch(isAdmin, (admin) => {
      if (admin) {
        checkStatus(true)
        startPolling()
      } else {
        stopPolling()
        status.value = null
      }
    }, { immediate: true })
  })

  return {
    status,
    needsSync,
    isSyncing,
    isLoading,
    error,
    checkStatus,
    syncNow,
  }
}
