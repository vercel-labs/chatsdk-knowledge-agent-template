<script setup lang="ts">
import { LazyModalConfirm, LazyModalShare } from '#components'

const route = useRoute()
const toast = useToast()
const overlay = useOverlay()
const { loggedIn, openInPopup } = useUserSession()

const open = ref(false)

const isAdminRoute = computed(() => route.path.startsWith('/admin'))

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

const { data: chats, refresh: refreshChats } = await useFetch<Chat[]>('/api/chats', {
  key: 'chats',
  transform: data => data.map(chat => ({
    id: chat.id,
    label: chat.title || 'Generating title…',
    generating: !chat.title,
    to: `/chat/${chat.id}`,
    icon: 'i-lucide-message-circle',
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

const items = computed(() => groups.value?.flatMap((group, groupIndex) => {
  return [
    {
      label: group.label,
      type: 'label' as const,
      class: groupIndex > 0 ? 'border-t border-default mt-2 pt-3' : ''
    }, ...group.items.map(item => ({
      ...item,
      slot: 'chat' as const,
      icon: undefined,
      class: item.generating ? 'text-muted' : ''
    }))
  ]
}))

// Limit displayed chats for performance
const DISPLAY_LIMIT = 40
const showAllChats = ref(false)

const displayedItems = computed(() => {
  if (!items.value || showAllChats.value) return items.value
  return items.value.slice(0, DISPLAY_LIMIT)
})

const hasMoreChats = computed(() => (items.value?.length ?? 0) > DISPLAY_LIMIT)

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
  ],
]

// Dual scroll fades for chat list
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
    >
      <template #header="{ collapsed }">
        <div v-if="!collapsed" class="flex items-center gap-1.5 w-full">
          <div class="flex-1 min-w-0">
            <UserMenu v-if="loggedIn" size="xs" />
            <UButton
              v-else
              label="Login"
              icon="i-simple-icons-github"
              color="neutral"
              variant="ghost"
              size="xs"
              block
              @click="openInPopup('/auth/github')"
            />
          </div>
          <UDashboardSearchButton collapsed size="xs" />
        </div>

        <template v-if="!collapsed">
          <UserStats v-if="loggedIn && !isAdminRoute" />

          <UButton
            v-if="!isAdminRoute"
            label="New chat"
            variant="soft"
            block
            to="/"
            @click="open = false"
          />
        </template>
      </template>

      <template #default="{ collapsed }">
        <!-- Admin mode -->
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
            <UserMenu v-if="loggedIn" collapsed />
            <UButton
              v-else
              icon="i-simple-icons-github"
              color="neutral"
              variant="ghost"
              square
              @click="openInPopup('/auth/github')"
            />
            <UDashboardSearchButton collapsed />
            <UDashboardSidebarCollapse />
          </template>
        </template>

        <!-- Chat mode -->
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
            <UButton
              v-else
              icon="i-simple-icons-github"
              color="neutral"
              variant="ghost"
              square
              @click="openInPopup('/auth/github')"
            />
            <UDashboardSearchButton collapsed />
            <UDashboardSidebarCollapse />
          </template>

          <div v-else class="flex flex-col flex-1 min-h-0 relative">
            <div
              v-show="showTopFade"
              class="pointer-events-none h-12 bg-gradient-to-b from-[var(--ui-bg)] to-transparent absolute top-0 inset-x-0 z-10 transition-opacity duration-150"
              :class="showTopFade ? 'opacity-100' : 'opacity-0'"
            />
            <UScrollArea ref="chatScrollArea" class="flex-1 min-h-0">
              <UNavigationMenu
                :items="displayedItems"
                :collapsed
                orientation="vertical"
                :ui="{ link: 'overflow-hidden', label: 'font-pixel tracking-wide uppercase text-[10px] text-muted pb-1' }"
              >
                <template #chat-label="{ item }">
                  <TextScramble v-if="(item as any).generating" />
                  <span v-else class="truncate">{{ item.label }}</span>
                </template>

                <template #chat-trailing="{ item }">
                  <div class="flex -mr-1.5 translate-x-full group-hover:translate-x-0 transition-transform">
                    <UButton
                      icon="i-lucide-share"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      class="text-muted hover:text-primary hover:bg-accented/50 focus-visible:bg-accented/50 p-0.5"
                      tabindex="-1"
                      @click.stop.prevent="shareChat(item as any)"
                    />
                    <UButton
                      icon="i-lucide-x"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      class="text-muted hover:text-primary hover:bg-accented/50 focus-visible:bg-accented/50 p-0.5"
                      tabindex="-1"
                      @click.stop.prevent="deleteChat((item as any).id)"
                    />
                  </div>
                </template>
              </UNavigationMenu>
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
              class="pointer-events-none h-20 bg-gradient-to-t from-[var(--ui-bg)] to-transparent -mt-20 relative z-10 shrink-0 transition-opacity duration-150"
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

    <div class="flex-1 flex m-2 rounded-xl ring ring-default bg-muted shadow-sm min-w-0 overflow-hidden" :class="isAdminRoute && 'flex-col'">
      <template v-if="isAdminRoute">
        <div class="shrink-0 flex items-center gap-1.5 sm:px-4 h-12">
          <UButton
            icon="i-lucide-arrow-left"
            label="Back"
            variant="ghost"
            color="neutral"
            size="xs"
            to="/"
          />
          <div class="flex-1" />
          <UColorModeButton />
        </div>
        <div class="flex-1 overflow-y-auto">
          <slot />
        </div>
      </template>
      <slot v-else />
    </div>
  </UDashboardGroup>
</template>
