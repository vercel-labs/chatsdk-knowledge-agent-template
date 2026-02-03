<script setup lang="ts">
import { LazyModalConfirm, LazyModalShare } from '#components'

const route = useRoute()
const toast = useToast()
const overlay = useOverlay()
const { loggedIn, openInPopup } = useUserSession()

const open = ref(false)

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
    label: chat.title || 'Untitled',
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

const items = computed(() => groups.value?.flatMap((group) => {
  return [
    {
      label: group.label,
      type: 'label' as const
    }, ...group.items.map(item => ({
      ...item,
      slot: 'chat' as const,
      icon: undefined,
      class: item.label === 'Untitled' ? 'text-muted' : ''
    }))
  ]
}))

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
      class="bg-elevated/50"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-end gap-0.5">
          <Logo class="h-8 w-auto shrink-0" />
          <span v-if="!collapsed" class="text-xl font-bold text-highlighted">Chat</span>
        </NuxtLink>

        <div v-if="!collapsed" class="flex items-center gap-1.5 ms-auto">
          <UDashboardSearchButton collapsed />
          <UDashboardSidebarCollapse />
        </div>
      </template>

      <template #default="{ collapsed }">
        <div class="flex flex-col gap-1.5">
          <UButton
            v-bind="collapsed ? { icon: 'i-lucide-plus' } : { label: 'New chat' }"
            variant="soft"
            block
            to="/"
            @click="open = false"
          />

          <template v-if="collapsed">
            <UDashboardSearchButton collapsed />
            <UDashboardSidebarCollapse />
          </template>
        </div>

        <UNavigationMenu
          v-if="!collapsed"
          :items
          :collapsed
          orientation="vertical"
          :ui="{ link: 'overflow-hidden' }"
        >
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
      </template>

      <template #footer="{ collapsed }">
        <UserMenu v-if="loggedIn" :collapsed />
        <UButton
          v-else
          :label="collapsed ? '' : 'Login with GitHub'"
          icon="i-simple-icons-github"
          color="neutral"
          variant="ghost"
          class="w-full"
          @click="openInPopup('/auth/github')"
        />
      </template>
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

    <slot />
  </UDashboardGroup>
</template>
