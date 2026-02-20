<script setup lang="ts">
useSeoMeta({ title: 'Users - Admin' })

type UserRole = 'user' | 'admin'

interface AdminUserRow {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: UserRole
  createdAt: string
  chatCount: number
  messageCount: number
  lastSeenAt: string | null
}

const toast = useToast()
const { showError } = useErrorToast()
const { user: currentUser } = useUserSession()

const searchQuery = ref('')
const roleFilter = ref<'all' | UserRole>('all')
const savingUserId = ref<string | null>(null)
const draftRoles = ref<Record<string, UserRole>>({})

const roleOptions = [
  { label: 'User', value: 'user' },
  { label: 'Admin', value: 'admin' },
]

const filterOptions = [
  { label: 'All roles', value: 'all' },
  { label: 'Admins', value: 'admin' },
  { label: 'Users', value: 'user' },
]

const { data: users, refresh, status } = useLazyFetch<AdminUserRow[]>('/api/admin/users')

watch(users, (rows) => {
  if (!rows) return
  draftRoles.value = Object.fromEntries(rows.map(row => [row.id, row.role]))
}, { immediate: true })

const filteredUsers = computed(() => {
  if (!users.value) return []

  const query = searchQuery.value.trim().toLowerCase()

  return users.value.filter((user) => {
    if (roleFilter.value !== 'all' && user.role !== roleFilter.value) {
      return false
    }

    if (!query) return true

    const name = user.name?.toLowerCase() ?? ''
    const email = user.email?.toLowerCase() ?? ''
    return name.includes(query) || email.includes(query)
  })
})

function formatDate(date: string | null): string {
  if (!date) return 'Never'
  return new Date(date).toLocaleDateString()
}

function isCurrentUser(userId: string): boolean {
  return currentUser.value?.id === userId
}

async function saveRole(row: AdminUserRow) {
  const nextRole = draftRoles.value[row.id]
  if (!nextRole || nextRole === row.role) return

  if (isCurrentUser(row.id) && nextRole !== 'admin') {
    toast.add({
      title: 'Not allowed',
      description: 'You cannot remove your own admin role.',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
    draftRoles.value[row.id] = row.role
    return
  }

  savingUserId.value = row.id
  try {
    await $fetch(`/api/admin/users/${row.id}`, {
      method: 'PATCH',
      body: { role: nextRole },
    })
    await refresh()
    toast.add({
      title: 'Role updated',
      icon: 'i-lucide-check',
    })
  } catch (e) {
    draftRoles.value[row.id] = row.role
    showError(e, { fallback: 'Failed to update role' })
  } finally {
    savingUserId.value = null
  }
}
</script>

<template>
  <div class="px-6 py-8 max-w-4xl mx-auto w-full">
    <header class="mb-8">
      <h1 class="text-lg font-medium text-highlighted mb-1 font-pixel tracking-wide">
        Users
      </h1>
      <p class="text-sm text-muted max-w-lg">
        Manage user access and roles across the platform.
      </p>
    </header>

    <div class="flex flex-col gap-6">
      <section>
        <h2 class="text-[10px] text-muted uppercase tracking-wide mb-3 font-pixel">
          Directory
        </h2>

        <div class="rounded-lg border border-default p-3 mb-3">
          <div class="flex flex-wrap items-center gap-2">
            <UInput
              v-model="searchQuery"
              icon="i-lucide-search"
              placeholder="Search by name or email"
              size="xs"
              class="w-full sm:w-72"
            />
            <USelect
              v-model="roleFilter"
              :items="filterOptions"
              value-key="value"
              size="xs"
              class="w-36"
            />
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-refresh-cw"
              size="xs"
              :loading="status === 'pending'"
              @click="refresh()"
            >
              Refresh
            </UButton>
          </div>
        </div>

        <div class="rounded-lg border border-default overflow-hidden">
          <div v-if="status === 'pending' && !users" class="px-4 py-3.5">
            <div v-for="i in 3" :key="i" class="flex items-center justify-between" :class="i > 1 && 'mt-3 pt-3 border-t border-default'">
              <div class="flex items-center gap-3">
                <USkeleton class="size-8 rounded-full" />
                <div>
                  <USkeleton class="h-4 w-32 mb-1" />
                  <USkeleton class="h-3 w-48" />
                </div>
              </div>
              <USkeleton class="h-8 w-36 rounded-md" />
            </div>
          </div>

          <table v-else-if="filteredUsers.length > 0" class="w-full text-sm">
            <thead class="bg-elevated/50 border-b border-default">
              <tr class="text-xs text-muted">
                <th class="text-left font-medium px-4 py-2.5">
                  User
                </th>
                <th class="text-right font-medium px-3 py-2.5">
                  Chats
                </th>
                <th class="text-right font-medium px-3 py-2.5">
                  Messages
                </th>
                <th class="text-left font-medium px-3 py-2.5">
                  Last active
                </th>
                <th class="text-left font-medium px-4 py-2.5">
                  Role
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="row in filteredUsers"
                :key="row.id"
                class="hover:bg-elevated/30"
              >
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-3 min-w-0">
                    <UAvatar :src="row.image || undefined" :alt="row.name || row.email || undefined" size="xs" />
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-highlighted truncate">
                          {{ row.name || 'Unnamed user' }}
                        </p>
                        <UBadge
                          v-if="isCurrentUser(row.id)"
                          label="You"
                          size="xs"
                          color="neutral"
                          variant="subtle"
                        />
                      </div>
                      <p class="text-xs text-muted truncate">
                        {{ row.email || 'No email' }} · Joined {{ formatDate(row.createdAt) }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-2.5 text-right text-muted tabular-nums">
                  {{ row.chatCount.toLocaleString() }}
                </td>
                <td class="px-3 py-2.5 text-right text-muted tabular-nums">
                  {{ row.messageCount.toLocaleString() }}
                </td>
                <td class="px-3 py-2.5 text-muted">
                  {{ formatDate(row.lastSeenAt) }}
                </td>
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <USelect
                      v-model="draftRoles[row.id]"
                      :items="roleOptions"
                      value-key="value"
                      class="w-28"
                      size="xs"
                      :disabled="savingUserId === row.id || isCurrentUser(row.id)"
                    />
                    <UButton
                      label="Save"
                      size="xs"
                      :disabled="draftRoles[row.id] === row.role || isCurrentUser(row.id)"
                      :loading="savingUserId === row.id"
                      @click="saveRole(row)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else class="px-4 py-10 text-center">
            <p class="text-sm text-muted">
              No users match your current filters.
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
