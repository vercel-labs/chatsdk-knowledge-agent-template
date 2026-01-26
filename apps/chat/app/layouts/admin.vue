<script setup lang="ts">
const { user, clear } = useUserSession()

const navItems = [
  { label: 'Sources', to: '/admin/sources', icon: 'i-lucide-book-open' },
]
</script>

<template>
  <div class="min-h-screen bg-default">
    <header class="sticky top-0 z-50 border-b border-default bg-elevated/80 backdrop-blur-sm">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-14">
          <div class="flex items-center gap-4">
            <NuxtLink to="/" class="flex items-center gap-2">
              <Logo class="h-7 w-auto" />
              <span class="font-semibold text-highlighted">Admin</span>
            </NuxtLink>

            <nav class="flex items-center gap-1 ml-4">
              <NuxtLink
                v-for="item in navItems"
                :key="item.to"
                :to="item.to"
                class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors"
                :class="$route.path.startsWith(item.to) ? 'bg-elevated text-highlighted' : 'text-muted hover:text-highlighted hover:bg-elevated/50'"
              >
                {{ item.label }}
              </NuxtLink>
            </nav>
          </div>

          <div class="flex items-center gap-3">
            <UButton
              to="/"
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-arrow-left"
            >
              Back to Chat
            </UButton>

            <UDropdownMenu
              :items="[
                [{ type: 'label', label: user?.name || user?.username, avatar: { src: user?.avatar } }],
                [{ label: 'Log out', icon: 'i-lucide-log-out', onSelect: () => { clear(); navigateTo('/') } }]
              ]"
            >
              <UAvatar
                :src="user?.avatar"
                :alt="user?.name || user?.username"
                size="sm"
                class="cursor-pointer"
              />
            </UDropdownMenu>
          </div>
        </div>
      </div>
    </header>

    <main>
      <slot />
    </main>
  </div>
</template>
