<script setup lang="ts">
import { LazyModalConfirm, LazyModalShare } from '#components'

const route = useRoute()
const toast = useToast()
const overlay = useOverlay()
const { loggedIn } = useUserSession()

const open = ref(false)

const isAdminRoute = computed(() => route.path.startsWith('/admin'))
const isSettingsRoute = computed(() => route.path.startsWith('/settings'))
const isHomepage = computed(() => route.path === '/')

const deleteModal = overlay.create(LazyModalConfirm, {
  props: {
    title: 'Delete chat',
    description: 'Are you sure you want to delete this chat? This cannot be undone.'
  }
})

const shareModal = overlay.create(LazyModalShare, {
  props: {
    chatId: '',
    isPublic: false,
    shareToken: null as string | null
  }
})

const { data: chats, refresh: refreshChats } = await useFetch('/api/chats', {
  key: 'chats',
  transform: data => data.map(chat => ({
    id: chat.id,
    label: chat.title || 'Generating title…',
    generating: !chat.title,
    to: `/chat/${chat.id}`,
    icon: chat.mode === 'admin' ? 'i-lucide-shield' : 'i-lucide-message-circle',
    mode: chat.mode,
    createdAt: chat.createdAt,
    isPublic: chat.isPublic,
    shareToken: chat.shareToken
  }))
})

watch(loggedIn, () => {
  refreshChats()
  open.value = false
})

const { groups } = useChats(chats)

const DISPLAY_LIMIT = 40
const showAllChats = ref(false)

const displayedGroups = computed(() => {
  if (!groups.value || showAllChats.value) return groups.value
  let count = 0
  return groups.value.map(group => {
    if (count >= DISPLAY_LIMIT) return { ...group, items: [] as typeof group.items }
    const items = group.items.slice(0, DISPLAY_LIMIT - count)
    count += items.length
    return { ...group, items }
  }).filter(g => g.items.length > 0)
})

const hasMoreChats = computed(() => {
  const total = groups.value?.reduce((sum, g) => sum + g.items.length, 0) ?? 0
  return total > DISPLAY_LIMIT
})

function chatContextItems(chat: UIChat) {
  return [
    [
      { label: 'Share', icon: 'i-lucide-share', onSelect: () => shareChat(chat) },
      { label: 'Delete', icon: 'i-lucide-trash', color: 'error' as const, onSelect: () => deleteChat(chat.id) },
    ]
  ]
}

const adminNavigation = [
  [
    { label: 'General', type: 'label' as const },
    { label: 'Sources', icon: 'i-lucide-database', to: '/admin', exact: true },
    { label: 'Assistant', icon: 'i-lucide-bot', to: '/admin/agent' },
  ],
  [
    { label: 'System', type: 'label' as const },
    { label: 'Sandbox', icon: 'i-lucide-box', to: '/admin/sandbox' },
    { label: 'Statistics', icon: 'i-lucide-bar-chart-3', to: '/admin/stats' },
    { label: 'Logs', icon: 'i-lucide-scroll-text', to: '/admin/logs' },
    { label: 'API Keys', icon: 'i-lucide-key', to: '/admin/api-keys' },
  ],
  [
    { label: 'Documentation', type: 'label' as const },
    { label: 'Getting Started', icon: 'i-lucide-rocket', to: '/admin/docs/getting-started' },
    { label: 'API Keys', icon: 'i-lucide-key', to: '/admin/docs/api-keys' },
    { label: 'SDK', icon: 'i-lucide-code', to: '/admin/docs/sdk' },
    { label: 'GitHub Bot', icon: 'i-simple-icons-github', to: '/admin/docs/github-bot' },
    { label: 'Discord Bot', icon: 'i-simple-icons-discord', to: '/admin/docs/discord-bot' },
    { label: 'Admin Mode', icon: 'i-lucide-shield', to: '/admin/docs/admin-mode' },
  ],
]

const adminContentArea = useTemplateRef<HTMLElement>('adminContentArea')
const chatScrollArea = useTemplateRef('chatScrollArea')
const showTopFade = ref(false)
const showBottomFade = ref(true)

function updateScrollFades() {
  const el = chatScrollArea.value?.$el as HTMLElement | undefined
  if (!el) return
  showTopFade.value = el.scrollTop > 8
  showBottomFade.value = el.scrollTop + el.clientHeight < el.scrollHeight - 8
}

watch(() => chatScrollArea.value?.$el, (el, _, onCleanup) => {
  if (!el) {
    showTopFade.value = false
    showBottomFade.value = true
    return
  }

  el.addEventListener('scroll', updateScrollFades, { passive: true })
  const ro = new ResizeObserver(updateScrollFades)
  ro.observe(el)
  nextTick(() => requestAnimationFrame(updateScrollFades))

  onCleanup(() => {
    el.removeEventListener('scroll', updateScrollFades)
    ro.disconnect()
  })
}, { flush: 'post' })

async function deleteChat(id: string) {
  const instance = deleteModal.open()
  const result = await instance.result
  if (!result) {
    return
  }

  await $fetch(`/api/chats/${id}`, { method: 'DELETE' })

  toast.add({
    title: 'Chat deleted',
    description: 'Your chat has been deleted',
    icon: 'i-lucide-trash'
  })

  refreshChats()

  if (route.params.id === id) {
    navigateTo('/')
  }
}

function shareChat(chat: { id: string, isPublic: boolean, shareToken: string | null }) {
  shareModal.open({
    chatId: chat.id,
    isPublic: chat.isPublic,
    shareToken: chat.shareToken
  })
}

watch(() => route.fullPath, () => {
  nextTick(() => {
    adminContentArea.value?.scrollTo({ top: 0 })
  })
})

defineShortcuts({
  c: () => {
    navigateTo('/')
  }
})
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      :min-size="12"
      collapsible
      resizable
      class="border-e-0"
      :ui="{
        header: 'h-auto shrink-0 flex flex-col items-stretch gap-3 px-4 py-3'
      }"
    >
      <template #header="{ collapsed }">
        <template v-if="isAdminRoute">
          <UButton
            v-if="!collapsed"
            icon="i-lucide-chevron-left"
            label="Back to app"
            variant="ghost"
            color="neutral"
            size="xs"
            to="/"
            class="self-start"
          />
        </template>

        <template v-else>
          <div v-if="!collapsed" class="flex items-center justify-between w-full">
            <UserMenu v-if="loggedIn" size="sm" />
            <UButton
              v-else
              label="Sign in"
              icon="i-lucide-log-in"
              color="neutral"
              variant="soft"
              size="xs"
              @click="navigateTo('/login')"
            />
            <UDashboardSearchButton collapsed size="xs" />
          </div>

          <template v-if="!collapsed">
            <UserStats v-if="loggedIn" />

            <UButton
              label="New chat"
              variant="soft"
              block
              to="/"
              @click="open = false"
            />
          </template>
        </template>
      </template>

      <template #default="{ collapsed }">
        <template v-if="isAdminRoute">
          <div class="flex-1 overflow-y-auto min-h-0">
            <UNavigationMenu
              :items="adminNavigation"
              :collapsed
              orientation="vertical"
              :ui="{ separator: 'h-6 bg-transparent', label: 'font-pixel tracking-wide uppercase text-[10px] text-muted pt-2 first:pt-0 pb-1' }"
            />
          </div>

          <template v-if="collapsed">
            <UTooltip text="Back to app">
              <UButton
                icon="i-lucide-chevron-left"
                variant="ghost"
                color="neutral"
                square
                to="/"
              />
            </UTooltip>
            <UDashboardSearchButton collapsed />
            <UDashboardSidebarCollapse />
          </template>
        </template>

        <template v-else>
          <template v-if="collapsed">
            <UButton
              icon="i-lucide-plus"
              variant="soft"
              block
              to="/"
              @click="open = false"
            />
            <UserMenu v-if="loggedIn" collapsed />
            <UTooltip v-else text="Sign in">
              <UButton
                icon="i-lucide-log-in"
                color="neutral"
                variant="soft"
                square
                @click="navigateTo('/login')"
              />
            </UTooltip>
            <UDashboardSearchButton collapsed />
            <UDashboardSidebarCollapse />
          </template>

          <div v-else class="flex flex-col flex-1 min-h-0 relative">
            <div
              v-show="showTopFade"
              class="pointer-events-none h-12 bg-linear-to-b from-default to-transparent absolute top-0 inset-x-0 z-10 transition-opacity duration-150"
              :class="showTopFade ? 'opacity-100' : 'opacity-0'"
            />
            <UScrollArea ref="chatScrollArea" class="flex-1 min-h-0">
              <nav class="flex flex-col gap-px p-1.5">
                <template v-for="(group, gi) in displayedGroups" :key="group.label">
                  <p
                    class="font-pixel tracking-wide uppercase text-[10px] text-muted px-2.5 pb-1"
                    :class="gi > 0 && 'border-t border-default mt-2 pt-3'"
                  >
                    {{ group.label }}
                  </p>
                  <UContextMenu
                    v-for="chat in group.items"
                    :key="chat.id"
                    :items="chatContextItems(chat)"
                    size="sm"
                  >
                    <NuxtLink
                      :to="chat.to"
                      class="group flex items-center gap-1.5 px-2 py-1 rounded-md text-sm overflow-hidden transition-colors"
                      :class="[
                        route.params.id === chat.id
                          ? 'text-highlighted bg-linear-to-r from-elevated to-elevated/0 brightness-125'
                          : 'text-muted hover:bg-linear-to-r from-elevated to-elevated/0',
                        chat.generating && 'text-muted!',
                      ]"
                      @click="open = false"
                    >
                      <UIcon v-if="(chat as any).mode === 'admin'" name="i-lucide-shield" class="size-4 shrink-0" />
                      <TextScramble v-if="chat.generating" />
                      <span v-else class="truncate">{{ chat.label }}</span>
                    </NuxtLink>
                  </UContextMenu>
                </template>
              </nav>
              <button
                v-if="hasMoreChats && !showAllChats"
                class="w-full py-2 px-2.5 text-left text-xs text-muted hover:text-highlighted transition-colors font-pixel tracking-wide"
                @click="showAllChats = true"
              >
                Show older chats
              </button>
            </UScrollArea>
            <div
              v-show="showBottomFade"
              class="pointer-events-none h-20 bg-linear-to-t from-default to-transparent -mt-20 relative z-10 shrink-0 transition-opacity duration-150"
              :class="showBottomFade ? 'opacity-100' : 'opacity-0'"
            />
          </div>
        </template>
      </template>

      <template #footer />
    </UDashboardSidebar>

    <UDashboardSearch
      placeholder="Search chats..."
      :groups="[{
        id: 'links',
        items: [{
          label: 'New chat',
          to: '/',
          icon: 'i-lucide-square-pen'
        }]
      }, ...groups]"
    />

    <div
      class="flex-1 flex flex-col m-2 min-w-0 relative transition-[margin] duration-300 ease-out"
      :class="!isAdminRoute && !isSettingsRoute && isHomepage ? 'mt-10' : 'mt-2'"
    >
      <div
        v-if="!isAdminRoute && !isSettingsRoute"
        class="absolute bottom-full left-0 right-0 flex justify-center pb-1 transition-opacity duration-300"
        :class="isHomepage ? 'opacity-100' : 'opacity-0 pointer-events-none'"
      >
        <ChatModeTabs />
      </div>

      <div class="flex-1 flex rounded-xl ring ring-default bg-muted shadow-sm min-w-0 overflow-hidden" :class="(isAdminRoute || isSettingsRoute) && 'flex-col'">
        <template v-if="isAdminRoute || isSettingsRoute">
          <div class="shrink-0 flex items-center justify-end sm:px-4 h-12">
            <UColorModeButton />
          </div>
          <div ref="adminContentArea" class="flex-1 overflow-y-auto">
            <slot />
          </div>
        </template>
        <slot v-else />
      </div>
    </div>
  </UDashboardGroup>
</template>
