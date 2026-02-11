<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}>()

const { user, signOut } = useUserSession()
const { isAdmin } = useAdmin()

const items = computed<DropdownMenuItem[][]>(() => {
  const baseItems: DropdownMenuItem[][] = []

  if (isAdmin.value) {
    baseItems.push([
      {
        label: 'Admin',
        icon: 'i-lucide-settings',
        to: '/admin',
      },
    ])
  }

  baseItems.push([
    {
      label: 'Settings',
      icon: 'i-lucide-user',
      to: '/settings',
    },
  ])

  baseItems.push([
    {
      label: 'Log out',
      icon: 'i-lucide-log-out',
      async onSelect() {
        await signOut()
        navigateTo('/')
      }
    }
  ])

  return baseItems
})
</script>

<template>
  <UDropdownMenu
    :items
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: [collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)', 'min-w-48'].join(' ') }"
    size="xs"
  >
    <UButton
      v-bind="{
        label: collapsed ? undefined : (user?.name ?? user?.username ?? undefined),
        trailingIcon: collapsed ? undefined : 'i-lucide-chevrons-up-down'
      }"
      :avatar="{
        src: user?.image || undefined,
        alt: user?.name ?? user?.username ?? undefined
      }"
      :size
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated transition-colors"
      :ui="{
        trailingIcon: 'text-dimmed',
        label: 'truncate'
      }"
    />

    <template #content-top="{ sub }">
      <div v-if="!sub" class="px-1.5 pt-1.5 pb-0.5">
        <div class="flex items-center gap-2 px-1 py-0.5">
          <UAvatar :src="user?.image" :alt="user?.name ?? user?.username" size="sm" />
          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium text-highlighted truncate">
              {{ user?.name ?? user?.username }}
            </p>
            <p class="text-[11px] text-muted truncate">
              {{ user?.email ?? `@${user?.username}` }}
            </p>
          </div>
        </div>
        <USeparator class="mt-1.5" />
      </div>
    </template>
  </UDropdownMenu>
</template>
