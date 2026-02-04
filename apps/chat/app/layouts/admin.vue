<script setup lang="ts">
const navigation = [
  {
    label: 'Sources',
    icon: 'i-lucide-database',
    to: '/admin',
    exact: true,
  },
  {
    label: 'Assistant',
    icon: 'i-lucide-bot',
    to: '/admin/agent',
  },
  {
    label: 'Sandbox',
    icon: 'i-lucide-box',
    to: '/admin/sandbox',
  },
  {
    label: 'Statistics',
    icon: 'i-lucide-bar-chart-3',
    to: '/admin/stats',
  },
]
</script>

<template>
  <UDashboardGroup>
    <UDashboardSidebar
      id="admin-sidebar"
      class="bg-elevated/50"
    >
      <template #header>
        <NuxtLink
          to="/"
          class="flex items-center gap-2 text-sm text-muted hover:text-highlighted transition-colors -ml-1"
        >
          <UIcon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" />
          <span>Back to Chat</span>
        </NuxtLink>
      </template>

      <template #default>
        <UNavigationMenu
          :items="[navigation]"
          orientation="vertical"
        />
      </template>

      <template #footer>
        <div class="text-xs text-muted px-2">
          Admin Panel
        </div>
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
