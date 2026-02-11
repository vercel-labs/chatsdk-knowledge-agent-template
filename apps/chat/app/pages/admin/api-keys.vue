<script setup lang="ts">
import { LazyModalConfirm } from '#components'

interface ApiKeyRow {
  id: string
  name: string | null
  prefix: string | null
  start: string | null
  userId: string
  enabled: boolean
  expiresAt: string | null
  createdAt: string
  userName: string | null
  userEmail: string | null
  userImage: string | null
  userRole: string | null
}

const toast = useToast()
const overlay = useOverlay()

const { data: keys, refresh, status } = useLazyFetch<ApiKeyRow[]>('/api/admin/api-keys')

const isCreating = ref(false)
const newKeyName = ref('')
const revealedKey = ref<string | null>(null)

const deleteModal = overlay.create(LazyModalConfirm, {
  props: {
    title: 'Revoke API key',
    description: 'Are you sure you want to revoke this API key? Any applications using it will lose access immediately.',
  },
})

async function createAdminKey() {
  isCreating.value = true
  try {
    const result = await $fetch('/api/admin/api-keys', {
      method: 'POST',
      body: { name: newKeyName.value.trim() || undefined },
    })
    revealedKey.value = (result as any).key ?? null
    newKeyName.value = ''
    await refresh()
    toast.add({ title: 'Admin API key created', icon: 'i-lucide-check' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || e?.message || 'Failed to create API key', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    isCreating.value = false
  }
}

async function revokeKey(id: string) {
  const instance = deleteModal.open()
  const confirmed = await instance.result
  if (!confirmed) return

  try {
    await $fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'API key revoked', icon: 'i-lucide-check' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || e?.message || 'Failed to revoke API key', color: 'error', icon: 'i-lucide-alert-circle' })
  }
}

function copyKey(key: string) {
  navigator.clipboard.writeText(key)
  toast.add({ title: 'Copied to clipboard', icon: 'i-lucide-clipboard-check' })
}
</script>

<template>
  <div class="px-6 py-8 max-w-2xl mx-auto w-full">
    <header class="mb-8">
      <h1 class="text-lg font-medium text-highlighted mb-1 font-pixel tracking-wide">
        API Keys
      </h1>
      <p class="text-sm text-muted max-w-lg">
        Manage all API keys across the platform. Create admin-level keys for bots and services.
      </p>
    </header>

    <div class="space-y-6">
      <!-- Revealed key banner -->
      <div v-if="revealedKey" class="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div class="flex items-center gap-2 mb-2">
          <UIcon name="i-lucide-alert-triangle" class="size-4 text-primary" />
          <p class="text-sm font-medium text-highlighted">
            Save your API key now
          </p>
        </div>
        <p class="text-xs text-muted mb-3">
          This key will only be shown once. Copy it now and store it securely.
        </p>
        <div class="flex items-center gap-2">
          <code class="flex-1 text-xs bg-elevated px-3 py-2 rounded-md font-mono break-all">{{ revealedKey }}</code>
          <UButton
            icon="i-lucide-copy"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="copyKey(revealedKey!)"
          />
        </div>
        <div class="mt-3">
          <UButton
            label="Done"
            size="xs"
            @click="revealedKey = null"
          />
        </div>
      </div>

      <!-- Create admin key -->
      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          Create admin key
        </h2>
        <div class="rounded-lg border border-default">
          <form class="flex items-center gap-3 px-4 py-3" @submit.prevent="createAdminKey">
            <UInput
              v-model="newKeyName"
              placeholder="Key name (e.g. GitHub Bot)"
              class="flex-1"
            />
            <UButton
              type="submit"
              :loading="isCreating"
              size="xs"
            >
              Create admin key
            </UButton>
          </form>
        </div>
      </section>

      <!-- All keys -->
      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          All keys
        </h2>
        <div class="rounded-lg border border-default divide-y divide-default">
          <div v-if="status === 'pending'" class="px-4 py-3.5">
            <div v-for="i in 3" :key="i" class="flex items-center justify-between" :class="i > 1 && 'mt-3 pt-3 border-t border-default'">
              <div class="flex items-center gap-3">
                <USkeleton class="size-7 rounded-full" />
                <div>
                  <USkeleton class="h-4 w-32 mb-1" />
                  <USkeleton class="h-3 w-48" />
                </div>
              </div>
              <USkeleton class="h-8 w-16 rounded-md" />
            </div>
          </div>
          <template v-else-if="keys?.length">
            <div
              v-for="key in keys"
              :key="key.id"
              class="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div class="flex items-center gap-3 min-w-0">
                <UAvatar :src="key.userImage || undefined" :alt="key.userName || undefined" size="xs" />
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="text-sm text-highlighted font-medium truncate">
                      {{ key.name || 'Unnamed key' }}
                    </p>
                    <UBadge v-if="key.userRole === 'admin'" label="Admin" size="xs" color="primary" variant="subtle" />
                    <UBadge v-if="!key.enabled" label="Disabled" size="xs" color="neutral" variant="subtle" />
                  </div>
                  <p class="text-xs text-muted truncate">
                    {{ key.userName || key.userEmail }} · {{ key.start ? `${key.start}...` : 'sk_...' }} · {{ new Date(key.createdAt).toLocaleDateString() }}
                  </p>
                </div>
              </div>
              <UButton
                label="Revoke"
                color="error"
                variant="ghost"
                size="xs"
                @click="revokeKey(key.id)"
              />
            </div>
          </template>
          <div v-else class="px-4 py-8 text-center">
            <p class="text-sm text-muted">
              No API keys have been created yet.
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
