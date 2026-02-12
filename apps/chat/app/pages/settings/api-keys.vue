<script setup lang="ts">
import { LazyModalConfirm } from '#components'

definePageMeta({ auth: 'user' })

const toast = useToast()
const overlay = useOverlay()
const { client } = useUserSession()

const { data: keys, refresh, status } = useLazyAsyncData('user-api-keys', () => client!.apiKey.list())

const isCreating = ref(false)
const newKeyName = ref('')
const revealedKey = ref<string | null>(null)

const deleteModal = overlay.create(LazyModalConfirm, {
  props: {
    title: 'Revoke API key',
    description: 'Are you sure you want to revoke this API key? Any applications using it will lose access immediately.',
  },
})

async function createKey() {
  if (!newKeyName.value.trim()) return
  isCreating.value = true
  try {
    const result = await client!.apiKey.create({ name: newKeyName.value.trim(), prefix: 'sk' })
    revealedKey.value = result.data?.key ?? null
    newKeyName.value = ''
    await refresh()
    toast.add({ title: 'API key created', icon: 'i-lucide-check' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || e?.message || 'Failed to create API key', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    isCreating.value = false
  }
}

async function revokeKey(keyId: string) {
  const instance = deleteModal.open()
  const confirmed = await instance.result
  if (!confirmed) return

  try {
    await client!.apiKey.delete({ keyId })
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
      <div class="flex items-center gap-2 mb-1">
        <UButton
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
          size="xs"
          to="/settings"
        />
        <h1 class="text-lg font-medium text-highlighted font-pixel tracking-wide">
          API Keys
        </h1>
      </div>
      <p class="text-sm text-muted max-w-lg">
        Create personal API keys to authenticate with the Savoir SDK.
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

      <!-- Create form -->
      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          Create a new key
        </h2>
        <div class="rounded-lg border border-default">
          <form class="flex items-center gap-3 px-4 py-3" @submit.prevent="createKey">
            <UInput
              v-model="newKeyName"
              placeholder="Key name (e.g. My App)"
              class="flex-1"
              required
            />
            <UButton
              type="submit"
              :loading="isCreating"
              size="xs"
              :disabled="!newKeyName.trim()"
            >
              Create key
            </UButton>
          </form>
        </div>
      </section>

      <!-- Keys list -->
      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          Your keys
        </h2>
        <div class="rounded-lg border border-default divide-y divide-default">
          <div v-if="status === 'pending'" class="px-4 py-3.5">
            <div v-for="i in 2" :key="i" class="flex items-center justify-between" :class="i > 1 && 'mt-3 pt-3 border-t border-default'">
              <div>
                <USkeleton class="h-4 w-32 mb-1" />
                <USkeleton class="h-3 w-48" />
              </div>
              <USkeleton class="h-8 w-16 rounded-md" />
            </div>
          </div>
          <template v-else-if="keys?.data?.length">
            <div
              v-for="key in keys.data"
              :key="key.id"
              class="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-sm text-highlighted font-medium truncate">
                    {{ key.name || 'Unnamed key' }}
                  </p>
                  <UBadge v-if="!key.enabled" label="Disabled" size="xs" color="neutral" variant="subtle" />
                </div>
                <p class="text-xs text-muted">
                  {{ key.start ? `${key.start}...` : 'sk_...' }} · Created {{ new Date(key.createdAt).toLocaleDateString() }}
                  <template v-if="key.expiresAt">
                    · Expires {{ new Date(key.expiresAt).toLocaleDateString() }}
                  </template>
                </p>
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
              No API keys yet. Create one to get started.
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
