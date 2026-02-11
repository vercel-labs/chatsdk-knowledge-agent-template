<script setup lang="ts">
import { LazyModalConfirm } from '#components'

definePageMeta({ auth: 'user' })

const toast = useToast()
const overlay = useOverlay()
const { client, user, session, signOut, fetchSession } = useUserSession()

// Profile
const nameInput = ref(user.value?.name ?? '')
const isSavingProfile = ref(false)

watch(user, (u) => {
  if (u) nameInput.value = u.name ?? ''
})

async function saveProfile() {
  isSavingProfile.value = true
  try {
    await client!.updateUser({ name: nameInput.value })
    await fetchSession({ force: true })
    toast.add({ title: 'Profile updated', icon: 'i-lucide-check' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || e?.message || 'Failed to update profile', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    isSavingProfile.value = false
  }
}

// Security
const currentPassword = ref('')
const newPassword = ref('')
const isChangingPassword = ref(false)

async function changePassword() {
  isChangingPassword.value = true
  try {
    await client!.changePassword({ currentPassword: currentPassword.value, newPassword: newPassword.value })
    currentPassword.value = ''
    newPassword.value = ''
    toast.add({ title: 'Password changed', icon: 'i-lucide-check' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || e?.message || 'Failed to change password', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    isChangingPassword.value = false
  }
}

// Connected accounts
const { data: accounts, refresh: refreshAccounts, status: accountsStatus } = useLazyAsyncData('user-accounts', () => client!.listAccounts())
const isLinkingGithub = ref(false)
const isUnlinking = ref(false)

const hasGithub = computed(() => accounts.value?.data?.some((a: any) => a.providerId === 'github'))
const hasPassword = computed(() => accounts.value?.data?.some((a: any) => a.providerId === 'credential'))
const accountCount = computed(() => accounts.value?.data?.length ?? 0)

async function linkGithub() {
  isLinkingGithub.value = true
  try {
    await client!.linkSocial({ provider: 'github' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || e?.message || 'Failed to link GitHub', color: 'error', icon: 'i-lucide-alert-circle' })
    isLinkingGithub.value = false
  }
}

async function unlinkGithub() {
  isUnlinking.value = true
  try {
    await client!.unlinkAccount({ providerId: 'github' })
    await refreshAccounts()
    toast.add({ title: 'GitHub account unlinked', icon: 'i-lucide-check' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || e?.message || 'Failed to unlink account', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    isUnlinking.value = false
  }
}

// Sessions
const { data: sessions, refresh: refreshSessions, status: sessionsStatus } = useLazyAsyncData('user-sessions', () => client!.listSessions())
const revokingSession = ref<string | null>(null)
const isRevokingAll = ref(false)

async function revokeSession(token: string) {
  revokingSession.value = token
  try {
    await client!.revokeSession({ token })
    await refreshSessions()
    toast.add({ title: 'Session revoked', icon: 'i-lucide-check' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || e?.message || 'Failed to revoke session', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    revokingSession.value = null
  }
}

async function revokeOtherSessions() {
  isRevokingAll.value = true
  try {
    await client!.revokeOtherSessions()
    await refreshSessions()
    toast.add({ title: 'Other sessions revoked', icon: 'i-lucide-check' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || e?.message || 'Failed to revoke sessions', color: 'error', icon: 'i-lucide-alert-circle' })
  } finally {
    isRevokingAll.value = false
  }
}

// Delete account
const deleteAccountModal = overlay.create(LazyModalConfirm, {
  props: {
    title: 'Delete account',
    description: 'Are you sure you want to delete your account? All your data will be permanently removed. This cannot be undone.',
  },
})
const isDeletingAccount = ref(false)

async function deleteAccount() {
  const instance = deleteAccountModal.open()
  const confirmed = await instance.result
  if (!confirmed) return

  isDeletingAccount.value = true
  try {
    await client!.deleteUser()
    await signOut()
    navigateTo('/login')
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message || e?.message || 'Failed to delete account', color: 'error', icon: 'i-lucide-alert-circle' })
    isDeletingAccount.value = false
  }
}
</script>

<template>
  <div class="px-6 py-8 max-w-2xl mx-auto w-full">
    <header class="mb-8">
      <h1 class="text-lg font-medium text-highlighted mb-1 font-pixel tracking-wide">
        Settings
      </h1>
      <p class="text-sm text-muted max-w-lg">
        Manage your profile, security, and connected accounts.
      </p>
    </header>

    <div class="space-y-8">
      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          Profile
        </h2>
        <div class="rounded-lg border border-default divide-y divide-default">
          <div class="flex items-center gap-4 px-4 py-3">
            <UAvatar :src="user?.image || undefined" :alt="user?.name ?? user?.username ?? undefined" size="lg" />
            <div class="min-w-0">
              <p class="text-sm text-highlighted font-medium truncate">
                {{ user?.name ?? user?.username }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ user?.email ?? `@${user?.username}` }}
              </p>
            </div>
          </div>
          <form class="flex items-center justify-between gap-4 px-4 py-3" @submit.prevent="saveProfile">
            <div class="flex-1 min-w-0">
              <p class="text-sm text-highlighted mb-1">
                Display name
              </p>
              <UInput
                v-model="nameInput"
                placeholder="Your name"
                class="w-full max-w-xs"
              />
            </div>
            <UButton
              type="submit"
              :loading="isSavingProfile"
              size="xs"
            >
              Save
            </UButton>
          </form>
        </div>
      </section>

      <section v-if="hasPassword">
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          Security
        </h2>
        <div class="rounded-lg border border-default divide-y divide-default">
          <form class="px-4 py-3 space-y-3" @submit.prevent="changePassword">
            <p class="text-sm text-highlighted">
              Change password
            </p>
            <UInput
              v-model="currentPassword"
              type="password"
              placeholder="Current password"
              required
              class="w-full max-w-xs"
            />
            <UInput
              v-model="newPassword"
              type="password"
              placeholder="New password"
              required
              class="w-full max-w-xs"
            />
            <UButton
              type="submit"
              :loading="isChangingPassword"
              size="xs"
            >
              Change password
            </UButton>
          </form>
        </div>
      </section>

      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          Connected accounts
        </h2>
        <div class="rounded-lg border border-default divide-y divide-default">
          <div v-if="accountsStatus === 'pending'" class="flex items-center justify-between px-4 py-3.5">
            <div>
              <USkeleton class="h-4 w-28 mb-1" />
              <USkeleton class="h-3 w-48" />
            </div>
            <USkeleton class="h-8 w-20 rounded-md" />
          </div>
          <div v-else class="flex items-center justify-between gap-4 px-4 py-3">
            <div class="flex items-center gap-3">
              <UIcon name="i-simple-icons-github" class="size-5 text-highlighted" />
              <div>
                <p class="text-sm text-highlighted">
                  GitHub
                </p>
                <p class="text-xs text-muted">
                  {{ hasGithub ? 'Connected' : 'Not connected' }}
                </p>
              </div>
            </div>
            <UButton
              v-if="hasGithub"
              label="Unlink"
              color="neutral"
              variant="ghost"
              size="xs"
              :loading="isUnlinking"
              :disabled="accountCount <= 1"
              @click="unlinkGithub"
            />
            <UButton
              v-else
              label="Link"
              size="xs"
              :loading="isLinkingGithub"
              @click="linkGithub"
            />
          </div>
        </div>
      </section>

      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          Active sessions
        </h2>
        <div class="rounded-lg border border-default divide-y divide-default">
          <div v-if="sessionsStatus === 'pending'" class="px-4 py-3.5">
            <div v-for="i in 2" :key="i" class="flex items-center justify-between" :class="i > 1 && 'mt-3 pt-3 border-t border-default'">
              <div>
                <USkeleton class="h-4 w-32 mb-1" />
                <USkeleton class="h-3 w-48" />
              </div>
              <USkeleton class="h-8 w-16 rounded-md" />
            </div>
          </div>
          <template v-else>
            <div
              v-for="s in sessions?.data"
              :key="s.token"
              class="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-sm text-highlighted truncate">
                    {{ s.userAgent || 'Unknown device' }}
                  </p>
                  <UBadge v-if="s.token === session?.token" label="Current" size="xs" variant="subtle" />
                </div>
                <p class="text-xs text-muted">
                  {{ s.ipAddress || 'Unknown IP' }} · Last active {{ new Date(s.updatedAt).toLocaleDateString() }}
                </p>
              </div>
              <UButton
                v-if="s.token !== session?.token"
                label="Revoke"
                color="neutral"
                variant="ghost"
                size="xs"
                :loading="revokingSession === s.token"
                @click="revokeSession(s.token)"
              />
            </div>
          </template>
          <div v-if="(sessions?.data?.length ?? 0) > 1" class="px-4 py-3">
            <UButton
              label="Revoke all other sessions"
              color="neutral"
              variant="ghost"
              size="xs"
              :loading="isRevokingAll"
              @click="revokeOtherSessions"
            />
          </div>
        </div>
      </section>

      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          Danger zone
        </h2>
        <div class="rounded-lg border border-error/30 bg-linear-to-br from-transparent to-error/10 divide-y divide-default">
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p class="text-sm text-highlighted">
                Delete account
              </p>
              <p class="text-xs text-muted">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <UButton
              label="Delete account"
              color="error"
              variant="soft"
              size="xs"
              :loading="isDeletingAccount"
              @click="deleteAccount"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
